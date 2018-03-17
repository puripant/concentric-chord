d3.json("all.json", function(error, data) {
  if (error) return console.warn(error);

  data.orgs.sort(function(a, b) { return a.type - b.type; });
  console.log(data);

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
              value: 1
            },
            target: {
              index: j,
              subindex: i,
              startAngle:   j*Math.PI*2/outerDataLength,
              endAngle: (j+1)*Math.PI*2/outerDataLength,
              value: ii
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
      value: d.type - 1
    });
  });
  var outerLengthSoFar = 0;
  chord2.groups = [];
  outerAttrs.forEach(function(d, i) {
    chord2.groups.push({
      index: i,
      startAngle:                  outerLengthSoFar*Math.PI*2/outerDataLength,
      endAngle: (outerLengthSoFar + data[d].length)*Math.PI*2/outerDataLength,
      value: data[d].length
    });
    outerLengthSoFar += data[d].length;
  });

  console.log(chord1);
  console.log(chord1.groups);
  console.log(chord2);
  console.log(chord2.groups);

  var svg = d3.select("svg");
  var width = +svg.attr("width");
  var height = +svg.attr("height");
  var outerRadius = Math.min(width, height) * 0.5 - 40;
  var tangentSize = 0;

  var formatValue = d3.formatPrefix(",.0", 1e3);

  // var chord = d3.chord()
  //     .padAngle(0.05)
  //     .sortSubgroups(d3.descending);
  // var matrix = [
  //   [0, 1, 1, 1],
  //   [2, 0, 2, 2],
  //   [3, 3, 0, 3],
  //   [4, 4, 4, 0]
  // ];
  // var matrix2 = [
  //   [0, 1, 1, 1],
  //   [2, 0, 2, 2],
  //   [3, 3, 0, 3],
  //   [4, 4, 4, 0]
  // ];
  // console.log(chord(matrix));
  // console.log(chord(matrix).groups);

  var arc = d3.arc()
      .innerRadius(outerRadius/2 - 10)
      .outerRadius(outerRadius/2);
  var arc2 = d3.arc()
      .innerRadius(outerRadius - 10)
      .outerRadius(outerRadius);

  var ribbon = d3.ribbon();
      // .radius(outerRadius - 10);

  var color = d3.scaleOrdinal(d3.schemeSet3);
  // var color = d3.scaleOrdinal()
  //     .domain(d3.range(4))
  //     .range(["#000000", "#FFDD89", "#957244", "#F26223"]);

  // group 1
  var g = svg.append("g")
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")")
      .datum(chord1);

  g.append("g")
      .attr("class", "ribbons")
    .selectAll("path")
    // .data(function(chords) { return chords; })
    .data(function(chords) {
      return chords.map(function(d) {
        d.source.radius = outerRadius/2;
        d.target.radius = outerRadius - 10;
        return d;
      });
    })
    .enter().append("path")
      .attr("d", function(d) {
        var parts = ribbon(d).split(/(?=[MmZzLlHhVvCcSsQqTtAa])/);
        if (parts.length > 4) {
          var subparts;
          var indices = [];
          var coords = [];
          for (var i = 0; i < parts.length; i++) {
            // example <path d="M141,141A200,200,0,0,0,200,0
            // C150,0,150,0,100,-50
            // S0,-150,0,-100
            // A100,100,0,0,1,100,0
            // C150,0,138,25,120,70
            // S105,105,141,141
            // Z" />
            if (parts[i].startsWith("A")) {
              indices.push(i);
              for (var j = 0; j < 2; j++) { //for A and Q pair
                subparts = parts[i+j].split(",");
                coords.push({
                  x: +subparts[subparts.length-2],
                  y: +subparts[subparts.length-1]
                });
                // console.log(subparts);
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
            radialVector(coords[0], "in", tangentSize),
            radialVector(coords[1], "in", tangentSize),
            radialVector(coords[2], "out", tangentSize*2),
            radialVector(coords[3], "out", tangentSize*2)
          ];
          var mid1 = {
            x: (coords[1].x+coords[3].x)/2,
            y: (coords[1].y+coords[3].y)/2
          }
          var mid2 = {
            x: (coords[0].x+coords[2].x)/2,
            y: (coords[0].y+coords[2].y)/2
          }
          var tangentMid1 = tangentVector(mid1, "counterclockwise", tangentSize);
          var tangentMid2 = tangentVector(mid2, "", tangentSize);

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
          // console.log(parts);
        }
        return parts.join("");
      })
      // .style("fill", function(d) { return color(d.target.value + data.types.length); })
      .style("fill", function(d) { return d3.rgb(200, 200, 200, 0.5); })
      // .style("fill", function(d) { return color(d.target.index); })
      // .style("stroke", function(d) { return d3.rgb(color(d.target.index)).darker(); });

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
      .style("fill", function(d) { return color(d.value); })
      .style("stroke", function(d) { return d3.rgb(color(d.value)).darker(); })
      .attr("d", arc);

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
      .style("fill", function(d) { return color(d.index + data.types.length + 1); })
      .style("stroke", function(d) { return d3.rgb(color(d.index + data.types.length + 1)).darker(); })
      .attr("d", arc2);

  // var groupTick = group.selectAll(".group-tick")
  //   .data(function(d) { return groupTicks(d, 1e3); })
  //   .enter().append("g")
  //     .attr("class", "group-tick")
  //     .attr("transform", function(d) { return "rotate(" + (d.angle * 180 / Math.PI - 90) + ") translate(" + outerRadius + ",0)"; });
  //
  // groupTick.append("line")
  //     .attr("x2", 6);
  //
  // groupTick
  //   .filter(function(d) { return d.value % 5e3 === 0; })
  //   .append("text")
  //     .attr("x", 8)
  //     .attr("dy", ".35em")
  //     .attr("transform", function(d) { return d.angle > Math.PI ? "rotate(180) translate(-16)" : null; })
  //     .style("text-anchor", function(d) { return d.angle > Math.PI ? "end" : null; })
  //     .text(function(d) { return formatValue(d.value); });
});

// Vector Math
function radialVector(coord, orientation, size) { //vector to or from the origin (0, 0)
  var distFromOrigin = Math.sqrt(coord.x*coord.x + coord.y*coord.y);
  var newCoord = {
    x: coord.x*size/distFromOrigin,
    y: coord.y*size/distFromOrigin
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
  var distFromOrigin = Math.sqrt(coord.x*coord.x + coord.y*coord.y);
  var newCoord = {
    x: ((coord.x*coord.y > 0)? -coord.y :  coord.y)*size/distFromOrigin,
    y: ((coord.x*coord.y > 0)?  coord.x : -coord.x)*size/distFromOrigin
  };
  if (orientation == "counterclockwise") { // the default is clockwise
    newCoord.x *= -1;
    newCoord.y *= -1;
  }
  newCoord.x += coord.x;
  newCoord.y += coord.y;
  return newCoord;
}

// Returns an array of tick angles and values for a given group and step.
function groupTicks(d, step) {
  var k = (d.endAngle - d.startAngle) / d.value;
  return d3.range(0, d.value, step).map(function(value) {
    return {value: value, angle: value * k + d.startAngle};
  });
}
