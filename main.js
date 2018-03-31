d3.json("all.json", function(error, data) {
  if (error) return console.warn(error);

  var svg = d3.select("svg");
  var width = +svg.attr("width");
  var height = +svg.attr("height");
  var outerRadius = Math.min(width, height) * 0.5 - 40;
  var tangentSize = outerRadius/4; //half of the distance between outer and innder (outer/2) radii

  data.orgs.sort(function(a, b) { return a.type - b.type; });

  var innerAttrs = ["area", "person", "relation", "result", "role", "strategy"];
  var outerAttrs = ["areas", "people", "relations", "results", "roles", "strategies"];
  var outerLengths = outerAttrs.map(function(d) { return data[d].length; });
  var outerStartIdx = [];
  outerLengths.reduce(function(a, b, i) { return outerStartIdx[i] = a + b; }, 0);
  outerStartIdx.unshift(0);
  var outerDataLength = outerStartIdx[outerAttrs.length];

  var chord1 = [];
  data.orgs.forEach(function(d, i) {
    innerAttrs.forEach(function(dd ,ii) {
      d[dd].forEach(function(e) {
        var j = outerStartIdx[ii] + data[outerAttrs[ii]].findIndex(function(f) { return f.id == e; });
        if (j >= outerStartIdx[ii] && j < outerStartIdx[ii+1]) {
          chord1.push({
            source: {
              index: i,
              subindex: j,
              startAngle:   i*Math.PI*2/data.orgs.length,
              endAngle: (i+1)*Math.PI*2/data.orgs.length,
              value: 1,
              radius: outerRadius/2,
            },
            target: {
              index: j,
              subindex: i,
              startAngle:   j*Math.PI*2/outerDataLength,
              endAngle: (j+1)*Math.PI*2/outerDataLength,
              value: ii,
              radius: outerRadius - 10,
            }
          });
        }
      });
    });
  });
  var chord2 = JSON.parse(JSON.stringify(chord1)); //deep clone

  chord1.groups = [];
  data.orgs.forEach(function(d, i) {
    chord1.groups.push({
      index: i,
      startAngle:   i*Math.PI*2/data.orgs.length,
      endAngle: (i+1)*Math.PI*2/data.orgs.length,
      value: d
    });
  });
  chord2.groups = [];
  var idx = 0;
  outerAttrs.forEach(function(attr, attrIdx) {
    data[attr].forEach(function(d, i) {
      d.type = attr;
      d.typeIdx = attrIdx;
      chord2.groups.push({
        index: idx,
        startAngle:   idx*Math.PI*2/outerDataLength,
        endAngle: (idx+1)*Math.PI*2/outerDataLength,
        value: d
      });
      idx++;
    });
  });

  var arc = d3.arc()
      .innerRadius(outerRadius/2 - 10)
      .outerRadius(outerRadius/2);
  var arc2 = d3.arc()
      .innerRadius(outerRadius - 10)
      .outerRadius(outerRadius);

  var color = d3.scaleOrdinal(d3.schemeSet3);

  // group 1
  var g = svg.append("g")
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")")
      .datum(chord1);

  var background = g.append("g")
      .attr("class", "ribbons")
    .selectAll("path")
    .data(function(chord) { return chord })
    .enter().append("path")
      .attr("d", path);
  var ribbons = g.append("g")
      .attr("class", "ribbons")
    .selectAll("path")
    .data(function(chord) { return chord })
    .enter().append("path")
      .attr("d", path)
      .style("fill", "#333")
      .style("fill-opacity", 0)
      .style("stroke", "#333")
      .style("stroke-opacity", 0)
      .style("stroke-width", 1);

  function path(d) {
    var parts = d3.ribbon()(d).split(/(?=[MmZzLlHhVvCcSsQqTtAa])/);
    if (parts.length > 4) {
      var subparts;
      var indices = [];
      var coords = [];
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].startsWith("A")) {
          indices.push(i);
          for (var j = 0; j < 2; j++) { //for A and Q pair
            subparts = parts[i+j].split(",");
            coords.push({
              x: +subparts[subparts.length-2],
              y: +subparts[subparts.length-1]
            });
          }
        }
      }
      coords.unshift(coords[coords.length-1])
      coords.splice(-1, 1);

      var newAStringParts = parts[indices[1]].split(",");
      newAStringParts[newAStringParts.length-3] = 0;
      newAStringParts[newAStringParts.length-2] = coords[2].x;
      newAStringParts[newAStringParts.length-1] = coords[2].y;

      var radialVectors = [
        radialVector(coords[0], "out", tangentSize-10),
        radialVector(coords[1], "out", tangentSize-10),
        radialVector(coords[2], "in", tangentSize-10),
        radialVector(coords[3], "in", tangentSize-10)
      ];

      var angle1 = (radianToOrigin(coords[0]) + radianToOrigin(coords[1]))/2;
      var angle2 = (radianToOrigin(coords[2]) + radianToOrigin(coords[3]))/2;
      var angleDiff = Math.abs((angle2 - angle1) % (2*Math.PI));

      //sampling a curve by recursively bisectoring it
      var coordAvg0 = scaleToSize(coordAverage(coords[0], coords[1]), outerRadius/2 + tangentSize);
      var coordAvg1 = scaleToSize(coordAverage(coords[2], coords[3]), outerRadius/2 + tangentSize);
      var arcSamplingCoords = [coordAvg0, radialAverage(coordAvg0, coordAvg1), coordAvg1];
      while(angleDiff > Math.PI/8) {
        for (var i = 0; i < arcSamplingCoords.length-1; i += 2) {
          arcSamplingCoords.splice(i+1, 0, radialAverage(arcSamplingCoords[i], arcSamplingCoords[i+1]));
        }
        angleDiff /= 2;
      }
      arcSamplingCoords.shift();
      arcSamplingCoords.pop();
      var arcSamplingNum = arcSamplingCoords.length;

      var newSVGstrings = [`Q${radialVectors[1].x},${radialVectors[1].y},${arcSamplingCoords[0].x},${arcSamplingCoords[0].y}`];
      for (var i = 1; i < arcSamplingNum; i++) {
        newSVGstrings.push(`L${arcSamplingCoords[i].x},${arcSamplingCoords[i].y}`);
      }
      newSVGstrings.push(`Q${radialVectors[3].x},${radialVectors[3].y},${coords[3].x},${coords[3].y}`,
        newAStringParts.join(","),
        `Q${radialVectors[2].x},${radialVectors[2].y},${arcSamplingCoords[arcSamplingNum-1].x},${arcSamplingCoords[arcSamplingNum-1].y}`);
      for (var i = arcSamplingNum-2; i >= 0; i--) {
        newSVGstrings.push(`L${arcSamplingCoords[i].x},${arcSamplingCoords[i].y}`);
      }
      newSVGstrings.push(`Q${radialVectors[0].x},${radialVectors[0].y},${coords[0].x},${coords[0].y}`);

      parts.splice.apply(parts, [indices[0]+1, 3].concat(newSVGstrings));
    }
    return parts.join("");
  }

  // tooltip
  var tip_fixed = false;
  var tip = d3.tip()
    .attr("class", "d3-tip")
    .html(function(d) {
      return d;
    });
  svg.call(tip);

  var mouseover = function(index, text, attr) {
    if (!tip_fixed) {
      ribbons
        .style("fill-opacity", function(path) {
          return (path[attr].index == index)? 0.8:0;
        })
        .style("stroke-opacity", function(path) {
          return (path[attr].index == index)? 0.8:0;
        })
      tip.show(text);
    }
  }
  var mouseout = function(text) {
    if (!tip_fixed) {
      ribbons
        .style("fill-opacity", 0)
        .style("stroke-opacity", 0);
      tip.hide(text);
    }
  }
  svg.on("click", function(d) {
    tip_fixed = !tip_fixed;
    mouseout(d);
  });
  svg.select("d3-tip").on("click", function(d) {
    tip_fixed = !tip_fixed;
    mouseout(d);
  });

  // group 1
  // var g = svg.append("g")
  //     .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")")
  //     .datum(chord1);

  var group = g.append("g")
      .attr("class", "groups")
    .selectAll("g")
      .data(function(chords) { return chords.groups; })
      .enter().append("g");

  group.append("path")
    .style("fill", function(d) { return color(d.value.type - 1); })
    .style("stroke", function(d) { return d3.rgb(color(d.value.type - 1)).darker(); })
    .attr("d", arc)
    .on("mouseover", function(d) { mouseover(d.index, d.value.thai_name, "source"); })
    .on("mouseout", mouseout);

  // group 2
  var g2 = svg.append("g")
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")")
      .datum(chord2);

  var group2 = g2.append("g")
      .attr("class", "groups")
    .selectAll("g")
      .data(function(chords) { return chords.groups; })
      .enter().append("g");

  group2.append("path")
    .style("fill", function(d) { return color(d.value.typeIdx + data.types.length + 1); })
    .style("stroke", function(d) { return d3.rgb(color(d.value.typeIdx + data.types.length + 1)).darker(); })
    .attr("d", arc2)
    .on("mouseover", function(d) { mouseover(d.index, d.value.name, "target"); })
    .on("mouseout", mouseout);
});

// Vector Math
function distToOrigin(coord) { //relative to origin (0, 0)
  return Math.sqrt(coord.x*coord.x + coord.y*coord.y);
}
function radianToOrigin(coord) { //relative to origin (0, 0)
  return Math.atan2(coord.y, coord.x); //Math.atan(coord.y/coord.x); //* 180 / Math.PI to convert to degree
}
function rotate(coord, angle) {
  var cos = Math.cos(angle);
  var sin = Math.sin(angle);
  return {
    x: coord.x*cos - coord.y*sin,
    y: coord.x*sin + coord.y*cos
  }
}
function opposite(coord) {
  return {
    x: -coord.x,
    y: -coord.y
  }
}
function isClockwise(a, b) { //relative to origin (0, 0)
  return a.x*b.y + a.y*b.x < 0; //cross-product
}
function coordAverage(a, b) {
  return {
    x: (a.x + b.x)/2,
    y: (a.y + b.y)/2
  };
}
function radialAverage(a, b) {
  var dist = (distToOrigin(a) + distToOrigin(b))/2;

  var angle1 = radianToOrigin(a);
  var angle2 = radianToOrigin(b);
  var angle = (angle1 + angle2)/2;
  if (Math.abs(angle1 - angle2) > Math.PI) {
    angle += Math.PI;
  }
  return {
    x: dist*Math.cos(angle),
    y: dist*Math.sin(angle)
  };
}
function scaleToSize(coord, size) {
  var dist = distToOrigin(coord);
  return {
    x: coord.x*size/dist,
    y: coord.y*size/dist
  };
}
function radialVector(coord, orientation, size) { //vector to or from the origin (0, 0)
  var newCoord = scaleToSize(coord, size);
  if (orientation == "in") {
    newCoord.x *= -1;
    newCoord.y *= -1;
  }
  newCoord.x += coord.x;
  newCoord.y += coord.y;
  return newCoord;
}
function tangentVector(coord, orientation, size) { //vector tangent to cirlces at the origin (0, 0)
  var newCoord = scaleToSize({
    x: ((coord.x*coord.y > 0)? -coord.y :  coord.y),
    y: ((coord.x*coord.y > 0)?  coord.x : -coord.x)
  }, size);
  if (orientation == "counterclockwise") { // the default is clockwise
    newCoord.x *= -1;
    newCoord.y *= -1;
  }
  newCoord.x += coord.x;
  newCoord.y += coord.y;
  return newCoord;
}
