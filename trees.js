var width = window.innerWidth;
var height = window.innerHeight;

var i = 0;
var duration = 750;
var root;

var tree = d3.layout.tree()
    .separation(function(a, b) {
        return a.parent == b.parent ? 1 : 1.3;
    })
    .nodeSize([120, 0]);

var diagonal = d3.svg.diagonal()
    .projection(function(d) { return [d.x, d.y]; });

var zoom = d3.behavior.zoom().translate([width/2, 0]).scale(0.8);
var svg = d3.select("body").append("svg")
    .attr("viewBox", "0 0 " + width + " " + height)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .call(zoom.on("zoom", redraw))
  .append("g")
    .attr("transform", "translate(" + width / 2 + ",20)scale(0.8)");

// Define the div for the tooltip
var tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

var color = d3.scale.linear()
    .domain([0, 0.5, 1])
    .range(["#4daf4a", "white", "#e41a1c"]);

var loadtree = function(treename) {
  console.log(treename);
  d3.json(treename, function(error, lnr) {
    data = lnr.tree_.nodes;
    var dataMap = data.reduce(function(map, node) {
        map[node.id] = node;
        return map;
    }, {});
    var treeData = [];
    data.forEach(function(node) {
        node.lnr = lnr;
        // add to parent
        var parent = dataMap[node.parent];
        if (parent) {
            // create child array if it doesn't exist
            (parent.children || (parent.children = []))
                // add node to child array
                .push(node);
        } else {
            // parent is null or missing
            treeData.push(node);
        }
    });

    root = treeData[0];
    root.x0 = width / 2;
    root.y0 = 0;
    console.log(root)
    console.log(width)
    update(root);
  });
}

function formatprob(prob) {
  return (prob * 100).toFixed(2);
}


var tooltipText = function(node) {
  var lnr = node.lnr;

  var tr;
  var td;
  var table = document.createElement("table")

  tr = document.createElement("tr");

  td = document.createElement("th");
  td.appendChild(document.createTextNode("Outcome"));
  tr.appendChild(td);

  td = document.createElement("th");
  td.appendChild(document.createTextNode("Count"));
  tr.appendChild(td);

  td = document.createElement("th");
  td.appendChild(document.createTextNode("Probability"));
  tr.appendChild(td);

  table.appendChild(tr);

  for (k = 0; k < lnr.n_classes_; k++) {
    tr = document.createElement("tr");

    td = document.createElement("td");
    td.appendChild(document.createTextNode(lnr.classes_.vs[k]));
    tr.appendChild(td);

    td = document.createElement("td");
    td.appendChild(document.createTextNode(node.sizes[k]));
    tr.appendChild(td);

    td = document.createElement("td");
    td.appendChild(document.createTextNode(formatprob(node.probs[k])));
    tr.appendChild(td);

    table.appendChild(tr);
  }


  return table.outerHTML;
};


function update(source) {
  // Compute the new tree layout.
  var nodes = tree.nodes(root).reverse()
  var links = tree.links(nodes);

  // Normalize for fixed-depth.
  nodes.forEach(function(d) { d.y = d.depth * 100; });

  // Update the nodes…
  var node = svg.selectAll("g.node")
      .data(nodes, function(d) { return d.d3id || (d.d3id = ++i); });

  // Enter any new nodes at the parent's previous position.
  var nodeEnter = node.enter().append("g")
      .attr("class", "node")
      .attr("transform", function(d) {
          return "translate(" + source.x0 + "," + source.y0 + ")";
      })
      .on("click", click);
  nodeEnter.append("rect")
      .attr("width", 100)
      .attr("height", 40)
      .attr("x", -50)
      .attr("y", -20)
      .attr("rx", 4)
      .attr("ry", 4)
      .style("fill-opacity", 1e-6)
      .style("fill", function(d) {
          if (d._children) {
            return "#bbb";
          } else if (d.children) {
            return "#fff";
          } else {
            return color(d.probs[1]);
          }
      })
      .on("mouseover", function(d) {
          tooltip.transition()
              .duration(200)
              .style("opacity", 1);
          tooltip.html(tooltipText(d))
              .style("left", (d3.event.pageX + 10) + "px")
              .style("top", (d3.event.pageY - 28) + "px");
      })
      .on("mousemove", function(d) {
          tooltip.style("left", (d3.event.pageX + 10) + "px")
              .style("top", (d3.event.pageY - 28) + "px")
      })
      .on("mouseout", function(d) {
          tooltip.transition()
              .duration(250)
              .style("opacity", 0);
      });
  nodeEnter.append("text")
      .attr("class", "node-title")
      .attr("text-anchor", "middle")
      .text(function(d) { return "Risk: " + formatprob(d.probs[1]) + "%;" + d.n_node_samples + " patients"; })
      .call(wrapsemicolons)
      .style("fill-opacity", 1e-6);
  nodeEnter.append("text")
      .attr("class", "split-title")
      .attr("y", 30)
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .text(function(d) {
          if (d.children || d._children) {
            return getvariabletext(d);
          }
      })
      .style("fill-opacity", 1e-6);

  // Transition nodes to their new position.
  var nodeUpdate = node.transition()
      .duration(duration)
      .attr("transform", function(d) {
          return "translate(" + d.x + "," + d.y + ")";
      });
  nodeUpdate.select("rect")
      .style("fill-opacity", 1)
      .style("fill", function(d) {
          if (d._children) {
            return "#bbb";
          } else if (d.children) {
            return "#fff";
          } else {
            return color(d.probs[1]);
          }
      });
  nodeUpdate.select("text.split-title")
      .style("fill-opacity", function(d) { return d._children ? 1e-6 : 1; });
  nodeUpdate.select("text.node-title")
      .style("fill-opacity", 1);

  // Transition exiting nodes to the parent's new position.
  var nodeExit = node.exit().transition()
      .duration(duration)
      .attr("transform", function(d) {
          return "translate(" + source.x + "," + source.y + ")";
      })
      .remove();
  nodeExit.select("rect")
      // .attr("height", 1e-6)
      // .attr("width", 1e-6)
      .style("fill-opacity", 1e-6);
  nodeExit.select("text.node-title")
      .style("fill-opacity", 1e-6);
  nodeExit.select("text.split-title")
      .style("fill-opacity", 1e-6);

  // Update the links…
  var link = svg.selectAll("g.link")
      .data(links, function(d) { return d.target.d3id; });
  // Enter any new links at the parent's previous position.
  var linkenter = link.enter()
      .insert("g", "g")  // insert so nodes draw over the top
      .attr("class", "link");

  linkenter.append("path")
      .attr("d", function(d) {
        var o = {x: source.x0, y: source.y0};
        return diagonal({source: o, target: o});
      });
  // Add labels
  linkenter.append("text")
      .attr("font-family", "Arial, Helvetica, sans-serif")
      .attr("fill", "Black")
      .style("font", "normal 12px Arial")
      .attr("transform", function(d) {
        return "translate(" + source.x0 + "," + source.y0 + ")";
      })
      .attr("dy", "0em")
      .attr("text-anchor", "middle")
      .style("fill-opacity", 1e-6)
      .text(function(d) {
        var text = getsplittext(d);
        numfactors = text.split(";").length;
        if (numfactors > 3) {
          text = numfactors + " factors";
        }
        if (text == "< 0.5") {
          text = "False";
        } else if (text == "≥ 0.5") {
          text = "True";
        }
        return text;
      })
      .call(wrapsemicolons)
      .on("mouseover", function(d) {
          var text = getsplittext(d);
          if (text.split(";").length > 3) {
            text = "<b>Factors</b><br>" + text.replace(/;/g, "<br>")
            tooltip.transition()
                .duration(200)
                .style("opacity", 1);
            tooltip.html(text)
                .style("left", (d3.event.pageX + 10) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
          }
      })
      .on("mousemove", function(d) {
          tooltip.style("left", (d3.event.pageX + 10) + "px")
              .style("top", (d3.event.pageY - 28) + "px")
      })
      .on("mouseout", function(d) {
          tooltip.transition()
              .duration(250)
              .style("opacity", 0);
      })
  // Transition links to their new position.
  link.selectAll("path")
      .transition()
      .duration(duration)
      .attr("d", diagonal);
  link.selectAll("text")
      .transition()
      .duration(duration)
      .style("fill-opacity", 1)
      .attr("transform", function(d) {
        return "translate(" +
            ((d.source.x + d.target.x)/2) + "," +
            ((d.source.y + d.target.y)/2) + ")";
      });
  // Transition exiting nodes to the parent's new position.
  var linkexit = link.exit();

  linkexit.transition()
      .duration(duration)
      .remove();

  linkexit.selectAll("path")
      .transition()
      .duration(duration)
      .attr("d", function(d) {
        var o = {x: source.x, y: source.y};
        return diagonal({source: o, target: o});
      })
      // .remove();
  linkexit.selectAll("text")
      .transition()
      .duration(duration)
      .style("fill-opacity", 1e-6)
      .attr("transform", function(d) {
        return "translate(" + source.x + "," + source.y + ")";
      })
      // .remove();

  // Stash the old positions for transition.
  nodes.forEach(function(d) {
    d.x0 = d.x;
    d.y0 = d.y;
  });
}
// Toggle children on click.
function click(d) {
  if (d.children) {
    d._children = d.children;
    d.children = null;
  } else {
    d.children = d._children;
    d._children = null;
  }
  update(d);
}

//Redraw for zoom
function redraw() {
  //console.log("here", d3.event.translate, d3.event.scale);
  svg.attr("transform",
      "translate(" + d3.event.translate + ")"
      + " scale(" + d3.event.scale + ")");
}

// Wrap factor levels onto lines
function wrapsemicolons(text) {
  text.each(function() {
    var text = d3.select(this)
    var words = text.text().split(";").reverse()
    var word
    var lineNumber = 0
    var lineHeight = 1.0 // ems
    var y = text.attr("y")
    var dy = parseFloat(text.attr("dy") || 0)
    var tspan = text.text(null)
      .append("tspan")
      .attr("x", 0)
      .attr("y", y)
      .attr("dy", dy + "em");

    var first = words.length > 1;
    while (word = words.pop()) {
      tspan = text.append("tspan")
          .attr("x", 0)
          .attr("y", y)
          // .attr("dy", ++lineNumber * lineHeight + dy + "em")
          .attr("dy", first ? "0em" : "1em")
          .text(word);
      first = false;
    }
  });
}

function collapseTree() {
  collapse(root);
  update(root);
}

function expandTree() {
  expand(root);
  update(root);
}

function collapse(d) {
  if (d.children) {
    d._children = d.children;
    d.children = null;
  }
  if (d._children) {
    d._children.forEach(collapse);
  }
}

function expand(d) {
  if (d._children) {
    d.children = d._children;
    d._children = null;
  }
  if (d.children) {
    d.children.forEach(expand);
  }
}

function getvariabletext(d) {
  var lnr = d.lnr;

  var varname;
  if (d.split_type == "CATEGORIC") {
    varname = lnr.feature_names_[lnr.col_map_categoric_to_X_[d.feature - 1] - 1]
  } else if (d.split_type == "PARALLEL") {
    varname = lnr.feature_names_[lnr.col_map_numeric_to_X_[d.feature - 1] - 1];
  }


  switch (varname) {
    case "Age":
      return "Age";
    case "SURGSPEC":
      return "Surgical Specialty";
    case "DIABETES":
      return "Diabetes";
    case "SMOKE":
      return "Smoker";
    case "DYSPNEA":
      return "Dyspnea";
    case "VENTILAT":
      return "Ventilator Dependent";
    case "HXCOPD":
      return "History of Severe COPD";
    case "ASCITES":
      return "Ascites";
    case "HXCHF":
      return "History of CHF";
    case "HYPERMED":
      return "Hypertension";
    case "RENAFAIL":
      return "Acute Renal Failure";
    case "DIALYSIS":
      return "On Dialysis";
    case "DISCANCR":
      return "Disseminated Cancer";
    case "WNDINF":
      return "Wound Infection";
    case "STEROID":
      return "Steriod Use";
    case "WTLOSS":
      return "Weight Loss";
    case "BLEEDDIS":
      return "Bleeding Disorders";
    case "TRANSFUS":
      return "Transfusion";
    case "PRSEPIS":
      return "Sepsis";
    case "PRSODM":
      return "Pre-op Serum Sodium";
    case "PRBUN":
      return "Pre-op BUN";
    case "PRCREAT":
      return "Pre-op Serum Creatinine";
    case "PRALBUM":
      return "Pre-op Serum Albumin";
    case "PRBILI":
      return "Pre-op Serum Bilirubin";
    case "PRSGOT":
      return "Pre-op SGOT";
    case "PRALKPH":
      return "Pre-op Alkline Phosphatase";
    case "PRWBC":
      return "Pre-op WBC";
    case "PRHCT":
      return "Pre-op Hematocrit";
    case "PRPLATE":
      return "Pre-op Platelet Count";
    case "PRPTT":
      return "Pre-op PTT";
    case "PRINR":
      return "Pre-op INR";
    case "PRPT":
      return "Pre-op PT";
    case "WNDCLAS":
      return "Wound Classification";
    case "ASACLAS":
      return "ASA Classification";
    case "AdmQtr":
      return "Quarter of Admission";
    case "RACE_NEW":
      return "Race";
    case "ETHNICITY_HISPANIC":
      return "Hispanic";
    case "SEX_MALE":
      return "Male";
    case "CPT_CAT":
      return "CPT";
    case "CPT_Digestive":
      return "CPT Digestive";
    case "CPT_Cardio":
      return "CPT Cardiovascular";
    case "CPT_Muscl":
      return "CPT Muscular";
    case "INOUT_OUTPATIENT":
      return "Outpatient";
    case "BMI":
      return "BMI";
    case "ICD9_AREA":
      return "ICD9 Area";
    case "ELECTSURG":
      return "Elective Surgery";
  }
}

function getsplittext(d) {
  var node = d.source;
  var lnr = node.lnr;
  var islower = node.lower_child == d.target.id

  if (node.split_type == "PARALLEL") {
    sign = islower ? "<" : "≥"
    return sign +  " " + (+node.threshold.toFixed(4));

  } else if (node.split_type == "CATEGORIC") {
    levels = [];
    for (var l = 0; l < lnr.n_categoric_levels_[node.feature - 1]; l++) {
      if (islower == node.categoric_split[l]) {
        levels.push(lnr.categoric_index_to_level_[node.feature - 1][l])
      }
    }
    return levels.join(";");
  }
}
