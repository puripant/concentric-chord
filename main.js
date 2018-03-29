d3.json("all.json", function(error, data) {
  if (error) return console.warn(error);

  var svg = d3.select("svg");
  var width = +svg.attr("width");
  var height = +svg.attr("height");
  var outerRadius = Math.min(width, height) * 0.5 - 40;
  var tangentSize = 50;

  data.orgs.sort(function(a, b) { return a.type - b.type; });
  // console.log(data);

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

  // console.log(chord1);
  // console.log(chord1.groups);
  // console.log(chord2);
  // console.log(chord2.groups);

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
      // console.log(coords);

      var newAStringParts = parts[indices[1]].split(",");
      newAStringParts[newAStringParts.length-3] = 0;
      newAStringParts[newAStringParts.length-2] = coords[2].x;
      newAStringParts[newAStringParts.length-1] = coords[2].y;

      var radialVectors = [
        radialVector(coords[0], "out", tangentSize),
        radialVector(coords[1], "out", tangentSize),
        radialVector(coords[2], "in", tangentSize),
        radialVector(coords[3], "in", tangentSize)
      ];
      var mid = radialAverage(coordAverage(coords[0], coords[1]), coordAverage(coords[2], coords[3]));
      var mid1 = mid; //nudgeToOrigin(mid, 1, "out"); //radialAverage(coords[1], coords[3]);
      var mid2 = mid; //nudgeToOrigin(mid, 1, "in"); //radialAverage(coords[0], coords[2]);
      // var mid1 = {
      //   x: (coords[1].x+coords[3].x)/2,
      //   y: (coords[1].y+coords[3].y)/2
      // }
      // var mid2 = {
      //   x: (coords[0].x+coords[2].x)/2,
      //   y: (coords[0].y+coords[2].y)/2
      // }

      var parts0 = parts[0].split(",");
      var parts1 = parts[1].split(",");
      var coord0 = {
        x: parts0[0].slice(1),
        y: parts0[1]
      }
      var coord1 = {
        x: parts1[5],
        y: parts1[6]
      }

      var angle1 = (radianToOrigin(coords[0]) + radianToOrigin(coords[1]))/2;
      var angle2 = (radianToOrigin(coords[2]) + radianToOrigin(coords[3]))/2;
      var angleDiff = Math.abs((angle2 - angle1) % (2*Math.PI));

      var tangentIn = (radianToOrigin(coord1) - radianToOrigin(coord0)) % (2*Math.PI); //positive for counterclockwise
      var tangentMid1 = tangentVector(mid1, (tangentIn > 0)? "counterclockwise":"", Math.min(tangentSize*angleDiff/2, tangentSize));
      var tangentMid2 = tangentVector(mid2, (tangentIn > 0)? "":"counterclockwise", Math.min(tangentSize*angleDiff/2, tangentSize));

      parts.splice(indices[0]+1, 3,
        `C${radialVectors[1].x},${radialVectors[1].y},${tangentMid1.x},${tangentMid1.y},${mid1.x},${mid1.y}`,
        `S${radialVectors[3].x},${radialVectors[3].y},${coords[3].x},${coords[3].y}`,
        newAStringParts.join(","),
        `C${radialVectors[2].x},${radialVectors[2].y},${tangentMid2.x},${tangentMid2.y},${mid2.x},${mid2.y}`,
        `S${radialVectors[0].x},${radialVectors[0].y},${coords[0].x},${coords[0].y}`);
        // "Q"+(x1*(0.7+j*0.6))+","+(y1*(0.7+j*0.6))+","+((x1+x2)/2)+","+((y1+y2)/2),
        // "T"+x2+","+y2);
        // "C"+(x1*(0.7+j*0.6))+","+(y1*(0.7+j*0.6))+","+((x1+x2)/2)+","+((y1+y2)/2),
        // "S"+x2+","+y2);
    }
    // console.log(parts);
    // 0 "M-8.082052866092418,-129.74852762736725"
    // 1 "A130,130,0,0,1,-2.3880612583373385e-14,-130"
    // 2 "C-3.3065463576978534e-14,-180,-18.61676810834812,-189.07114467323012,-15.972435706244802,-189.29427044021878"
    // 3 "S-19.767912721830974,-148.6917268264179,-32.946521203051624,-247.81954471069645"
    // 4 "A250,250,0,0,0,-35.46434802931588,-247.4717762066122"
    // 5 "C-21.278608817589525,-148.4830657239673,-13.328103304141486,-189.51739620720744,-15.972435706244802,-189.29427044021878"
    // 6 "S-11.190534737666425,-179.65180748404697,-8.082052866092418,-129.74852762736725"
    // 7 "Z"
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
      // ribbons.classed("highlight", function(path) {
      //   return path[attr].index == d.index;
      // });
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
      // ribbons.classed("highlight", false);
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
function nudgeToOrigin(coord, unit, direction) { //relative to origin (0, 0)
  var ratio = unit/distToOrigin(coord);
  if (direction === "out") {
    ratio *= -1;
  }
  return {
    x: coord.x*(1-ratio),
    y: coord.y*(1-ratio)
  };
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
function radialVector(coord, orientation, size) { //vector to or from the origin (0, 0)
  var dist = distToOrigin(coord);
  var newCoord = {
    x: coord.x*size/dist,
    y: coord.y*size/dist
  };
  if (orientation == "in") {
    newCoord.x *= -1;
    newCoord.y *= -1;
  }
  newCoord.x += coord.x;
  newCoord.y += coord.y;
  return newCoord;
}
function tangentVector(coord, orientation, size) { //vector tangent to cirlces at the origin (0, 0)
  var dist = distToOrigin(coord);
  var newCoord = {
    x: ((coord.x*coord.y > 0)? -coord.y :  coord.y)*size/dist,
    y: ((coord.x*coord.y > 0)?  coord.x : -coord.x)*size/dist
  };
  if (orientation == "counterclockwise") { // the default is clockwise
    newCoord.x *= -1;
    newCoord.y *= -1;
  }
  newCoord.x += coord.x;
  newCoord.y += coord.y;
  return newCoord;
}
