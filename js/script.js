const width = 900;
const height = 900;
const innerRadius = 180;
const outerRadius = 320;


// Color scales
const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

// Tooltip for hover interactivity
const tooltip = d3.select("#tooltip");

let currentView = "radial"; // Tracks the current active chart: "radial" or "stacked"

// Load data
d3.csv("data/combined_dataset.csv", d => ({
  Year: d.Year,
  "Full Time Student": d["Full Time Student"],
  "GAD7 Category": d["GAD7 Category"] ? d["GAD7 Category"].trim() : null,
  "PHQ9 Category": d["PHQ9 Category"] ? d["PHQ9 Category"].trim() : null,
  MaleCount: +d.MaleCount,
  FemaleCount: +d.FemaleCount,
  sentiment: +d.sentiment,
  words: [d.Word_1, d.Word_2, d.Word_3, d.Word_4, d.Word_5, d.Word_6, d.Word_7, d.Word_8, d.Word_9, d.Word_10]
})).then(data => {
  const years = [...new Set(data.map(d => d.Year))].sort();
//   const yearSelector = d3.select("#year-selector");
  const studentSelector = d3.select("#student-filter");
  const categorySelector = d3.select("#category-selector");

  const yearExtent = d3.extent(data, d => +d.Year); // Get min and max years
d3.select("#time-slider")
  .attr("min", yearExtent[0])
  .attr("max", yearExtent[1])
  .attr("value", yearExtent[0]); // Default to the earliest year

d3.select("#time-slider-value").text(yearExtent[0]); // Initialize display


d3.select("#student-filter").on("change", function () {
    const selectedYear = timeSlider.node().value; // Get the current year from the slider
    updateChart(selectedYear); // Call updateChart with the current year
  });
  
  d3.select("#category-selector").on("change", function () {
    const selectedYear = timeSlider.node().value; // Get the current year from the slider
    updateChart(selectedYear); // Call updateChart with the current year
  });
  

// Toggle buttons for switching between charts

d3.select("#flatten-button").on("click", () => {
    currentView = "stacked"; // Update the current view
    d3.select("#word-cloud").style("display", "none"); // Hide word cloud
    updateStackedBarChart(data);
    d3.select("#flatten-button").style("display", "none");
    d3.select("#radial-button").style("display", "inline");
});

d3.select("#radial-button").on("click", () => {
    currentView = "radial"; // Update the current view
    d3.select("#word-cloud").style("display", "flex"); // Show word cloud
    updateRadialChart(data, "All", "All");
    d3.select("#flatten-button").style("display", "inline");
    d3.select("#radial-button").style("display", "none");
});

d3.select("#line-button").on("click", () => {
    currentView = "line"; // Update the current view
    d3.select("#word-cloud").style("display", "none"); // Hide word cloud
    updateLineChart(data); // Render the line chart
    d3.select("#flatten-button").style("display", "inline");
    d3.select("#radial-button").style("display", "inline");
  });
  
  const timeSlider = d3.select("#time-slider");
  const timeSliderValue = d3.select("#time-slider-value");
  
  timeSlider.on("input", function () {
    const selectedYear = this.value;
    timeSliderValue.text(selectedYear); // Update the displayed year value
    updateChart(selectedYear); // Call `updateChart` with the selected year
  });
  

  // Initial rendering
  updateRadialChart(data, "All", "All");



function updateChart(selectedYear = "All") {
    const studentFilter = d3.select("#student-filter").node().value;
    const categoryFilter = d3.select("#category-selector").node().value;
   
  
    if (currentView === "radial") {
      updateRadialChart(data, selectedYear, studentFilter);
    } else if (currentView === "stacked") {
      updateStackedBarChart(data, categoryFilter, selectedYear, studentFilter);
    }
  }
  

  // Radial Chart
  function updateRadialChart(data, selectedYear, studentFilter) {
    const filteredData = data.filter(d => {
      const matchesYear = selectedYear === "All" || d.Year === selectedYear;
      const matchesStudent = studentFilter === "All" || d["Full Time Student"] === studentFilter;
      return matchesYear && matchesStudent && d["GAD7 Category"];
    });


    const summarizedData = d3.group(
      filteredData,
      d => d["GAD7 Category"],
      d => d["PHQ9 Category"]
    );

    const hierarchicalData = Array.from(summarizedData, ([gad7, gad7Group]) => ({
      category: gad7,
      values: Array.from(gad7Group, ([phq9, entries]) => ({
        subcategory: phq9,
        MaleCount: d3.sum(entries, d => d.MaleCount),
        FemaleCount: d3.sum(entries, d => d.FemaleCount)
      }))
    }));

    const angleScale = d3.scaleBand()
      .domain(hierarchicalData.map(d => d.category))
      .range([0, 2 * Math.PI]);

    const radiusScale = d3.scaleLinear()
      .domain([0, d3.max(hierarchicalData, d => d3.max(d.values, v => v.MaleCount + v.FemaleCount))])
      .range([innerRadius, outerRadius]);

    d3.select("#chart").selectAll("*").remove();

    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);



    const groups = svg.selectAll(".category")
      .data(hierarchicalData)
      .enter()
      .append("g");

      groups.selectAll("path")
      .data(d => d.values.map(v => ({ ...v, category: d.category })))
      .enter()
      .append("path")
      .attr("d", d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(d => radiusScale(d.MaleCount + d.FemaleCount))
        .startAngle(d => angleScale(d.category))
        .endAngle(d => angleScale(d.category) + angleScale.bandwidth()))
      .attr("fill", d => colorScale(d.subcategory))
      .attr("opacity", 0.8) // Initial opacity
      .on("mouseover", (event, d) => {
        d3.select(event.target).transition().duration(200).attr("opacity", 1); // Highlight on hover
        tooltip.style("opacity", 1)
          .html(`
            <strong>GAD7:</strong> ${d.category}<br>
            <strong>PHQ9:</strong> ${d.subcategory}<br>
            <strong>Male:</strong> ${d.MaleCount}<br>
            <strong>Female:</strong> ${d.FemaleCount}
          `)
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY}px`);
      })
      .on("mouseout", (event) => {
        d3.select(event.target).transition().duration(200).attr("opacity", 0.8); // Reset opacity
        tooltip.style("opacity", 0);
      })
      .transition()
      .duration(1000)
      .attrTween("d", function(d) {
        const interpolate = d3.interpolate(0, radiusScale(d.MaleCount + d.FemaleCount));
        return function(t) {
          return d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(interpolate(t))
            .startAngle(angleScale(d.category))
            .endAngle(angleScale(d.category) + angleScale.bandwidth())();
        };
      });

      

    // Add Word Cloud for the selected Year
    const yearData = filteredData.filter(d => d.Year === selectedYear || selectedYear === "All");
    const wordCounts = yearData.reduce((acc, d) => {
      d.words.forEach(word => {
        acc[word] = (acc[word] || 0) + 1;
      });
      return acc;
    }, {});

    const wordCloudData = Object.keys(wordCounts).map(word => ({
      text: word,
      size: wordCounts[word] * 10 // Adjust the multiplier for word cloud size
    }));

    updateWordCloud(wordCloudData);

    
  }



function updateStackedBarChart(data, categoryKey = "GAD7 Category", selectedYear = "All", studentFilter = "All") {
    const filteredData = data.filter(d => {
        const matchesYear = selectedYear === "All" || d.Year === selectedYear;
        const matchesStudent = studentFilter === "All" || d["Full Time Student"] === studentFilter;
        return matchesYear && matchesStudent && d[categoryKey];
    });

    // Summarize data by category
    const summarizedData = d3.rollup(
        filteredData,
        v => ({
            Male: d3.sum(v, d => d.MaleCount),
            Female: d3.sum(v, d => d.FemaleCount)
        }),
        d => d[categoryKey]
    );

    // Transform data into an array for stacking
    const stackedData = Array.from(summarizedData, ([category, counts]) => ({
        category,
        Male: counts.Male,
        Female: counts.Female
    })).sort((a, b) => a.category.localeCompare(b.category));

    // Chart dimensions and margins
    const margin = { top: 50, right: 150, bottom: 100, left: 70 };
    const chartWidth = 900 - margin.left - margin.right;
    const chartHeight = 600 - margin.top - margin.bottom;

    // Remove previous chart
    d3.select("#chart").selectAll("*").remove();

    // Create SVG
    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", chartWidth + margin.left + margin.right)
        .attr("height", chartHeight + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Create scales
    const xScale = d3.scaleBand()
        .domain(stackedData.map(d => d.category))
        .range([0, chartWidth])
        .padding(0.3);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(stackedData, d => d.Male + d.Female)])
        .nice()
        .range([chartHeight, 0]);

    // Add axes
    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0, ${chartHeight})`)
        .call(d3.axisBottom(xScale))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");

    svg.append("g")
        .attr("class", "y-axis")
        .call(d3.axisLeft(yScale));

    // Define stack generator
    const stack = d3.stack().keys(["Male", "Female"]);

    // Generate stack layers
    const layers = stack(stackedData);

    // Draw the stacked bars
    svg.selectAll(".layer")
        .data(layers)
        .enter()
        .append("g")
        .attr("class", "layer")
        .attr("fill", (d, i) => colorScale(d.key)) // Assign colors for Male and Female
        .selectAll("rect")
        .data(d => d)
        .enter()
        .append("rect")
        .attr("x", d => xScale(d.data.category))
        .attr("y", d => yScale(d[1]))
        .attr("height", d => yScale(d[0]) - yScale(d[1]))
        .attr("width", xScale.bandwidth())
        .on("mouseover", (event, d) => {
            const gender = d.data.Male === (d[1] - d[0]) ? "Male" : "Female";
            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>Category:</strong> ${d.data.category}<br>
                    <strong>${gender} Count:</strong> ${d[1] - d[0]}
                `)
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY}px`);
        })
        .on("mouseout", () => tooltip.style("opacity", 0));

    // Add labels to the stacked bars
    svg.selectAll(".layer")
        .data(layers)
        .selectAll("text")
        .data(d => d)
        .enter()
        .append("text")
        .attr("x", d => xScale(d.data.category) + xScale.bandwidth() / 2)
        .attr("y", d => yScale((d[0] + d[1]) / 2)) // Position in the middle of each segment
        .attr("dy", "0.35em") // Center vertically
        .text(d => d[1] - d[0]) // Display the value
        .attr("fill", "white") // Make the label visible on darker bars
        .attr("font-size", "12px")
        .attr("text-anchor", "middle");

    // Add a legend
    const legend = svg.append("g")
    .attr("transform", `translate(${chartWidth + 20}, 0)`); // Position the legend to the right of the chart
  
  const legendData = ["Male", "Female"];
  legend.selectAll("rect")
    .data(legendData)
    .enter()
    .append("rect")
    .attr("x", 0)
    .attr("y", (d, i) => i * 25)
    .attr("width", 20)
    .attr("height", 20)
    .attr("fill", (d, i) => colorScale(d))
    .style("cursor", "pointer")
    .on("click", (event, category) => {
      // Toggle visibility of bars by category
      const isVisible = d3.selectAll(`.bar-${category}`).style("opacity") === "1";
      d3.selectAll(`.bar-${category}`).transition().style("opacity", isVisible ? 0 : 1);
    });
  
  legend.selectAll("text")
    .data(legendData)
    .enter()
    .append("text")
    .attr("x", 30)
    .attr("y", (d, i) => i * 25 + 15)
    .text(d => d)
    .style("font-size", "14px")
    .style("cursor", "pointer")
    .on("click", (event, category) => {
      const isVisible = d3.selectAll(`.bar-${category}`).style("opacity") === "1";
      d3.selectAll(`.bar-${category}`).transition().style("opacity", isVisible ? 0 : 1);
    });

    svg.selectAll("rect")
  .on("mouseover", (event, d) => {
    tooltip.style("opacity", 1)
      .html(`
        <strong>Category:</strong> ${d.data.category}<br>
        <strong>${d.key}:</strong> ${d[1] - d[0]}
      `)
      .style("left", `${event.pageX + 10}px`)
      .style("top", `${event.pageY}px`);
  })
  .on("mouseout", () => tooltip.style("opacity", 0));

  
}


//   // Word Cloud Function

function updateWordCloud(data) {
    const wordCloud = d3.select("#word-cloud");
    wordCloud.selectAll("*").remove();

    const layout = d3.layout.cloud()
        .size([320, 320]) // Set word cloud size
        .words(data)
        .rotate(() => Math.random() * 90) // Optional: random rotation of words
        .fontSize(d => d.size) // Font size based on word frequency
        .on("end", drawWordCloud);

    layout.start();

    function drawWordCloud(words) {
        const svg = wordCloud.append("svg")
            .attr("width", layout.size()[0])
            .attr("height", layout.size()[1])
            .append("g")
            .attr("transform", `translate(${layout.size()[0] / 2}, ${layout.size()[1] / 2})`); // Center the group initially

        svg.selectAll("text")
            .data(words)
            .enter().append("text")
            .style("font-size", d => `${d.size}px`)
            .style("fill", (d, i) => colorScale(i)) // Apply colors
            .attr("text-anchor", "middle") // Center the text
            .attr("transform", d => `translate(${d.x},${d.y})rotate(${d.rotate})`)
            .text(d => d.text);

        // Adjust the entire group to align vertically within the container
        const svgHeight = svg.node().getBoundingClientRect().height; // Get the height of the group
        const containerHeight = wordCloud.node().getBoundingClientRect().height;
        const translateY = (containerHeight - svgHeight) / 2; // Center vertically
        svg.attr("transform", `translate(${layout.size()[0] / 2}, ${layout.size()[1] / 2 + translateY})`); // Adjust vertical position
    }
}
function updateLineChart(data) {
    const filteredData = data.filter(d => d.Year !== "All");
  
    const summarizedData = d3.rollup(
      filteredData,
      v => ({
        Male: d3.sum(v, d => d.MaleCount),
        Female: d3.sum(v, d => d.FemaleCount),
      }),
      d => d.Year
    );
  
    const lineData = Array.from(summarizedData, ([year, counts]) => ({
      year: +year,
      male: counts.Male,
      female: counts.Female,
    })).sort((a, b) => a.year - b.year);
  
    // Chart dimensions and margins
    const margin = { top: 60, right: 150, bottom: 50, left: 70 };
    const chartWidth = 900 - margin.left - margin.right;
    const chartHeight = 600 - margin.top - margin.bottom;
  
    // Remove previous chart
    d3.select("#chart").selectAll("*").remove();
  
    // Create SVG
    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", chartWidth + margin.left + margin.right)
      .attr("height", chartHeight + margin.top + margin.bottom);
  
    const chartGroup = svg
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);
  
    // Create scales
    const xScale = d3.scaleLinear()
      .domain(d3.extent(lineData, d => d.year))
      .range([0, chartWidth]);
  
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(lineData, d => Math.max(d.male, d.female))])
      .nice()
      .range([chartHeight, 0]);
  
    // Add grid lines
    chartGroup
      .append("g")
      .attr("class", "grid")
      .call(
        d3.axisLeft(yScale)
          .tickSize(-chartWidth)
          .tickFormat("")
      )
      .selectAll("line")
      .attr("stroke", "#ddd");
  
    chartGroup
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(
        d3.axisBottom(xScale)
          .tickSize(-chartHeight)
          .tickFormat("")
      )
      .selectAll("line")
      .attr("stroke", "#ddd");
  
    // Add axes
    chartGroup
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(d3.axisBottom(xScale).tickFormat(d3.format("d")))
      .selectAll("text")
      .style("font-size", "12px");
  
    chartGroup
      .append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(yScale))
      .selectAll("text")
      .style("font-size", "12px");
  
    // Create line generators
    const lineMale = d3.line()
      .x(d => xScale(d.year))
      .y(d => yScale(d.male))
      .curve(d3.curveCatmullRom); // Smooth curve
  
    const lineFemale = d3.line()
      .x(d => xScale(d.year))
      .y(d => yScale(d.female))
      .curve(d3.curveCatmullRom); // Smooth curve
  
    // Add male line
    chartGroup
      .append("path")
      .datum(lineData)
      .attr("fill", "none")
      .attr("stroke", "#007BFF") // Blue color for males
      .attr("stroke-width", 3)
      .attr("d", lineMale);
  
    // Add female line
    chartGroup
      .append("path")
      .datum(lineData)
      .attr("fill", "none")
      .attr("stroke", "#FF5733") // Orange color for females
      .attr("stroke-width", 3)
      .attr("d", lineFemale);
  
    // Add points and tooltips
    const tooltip = d3.select("#tooltip");
  
    ["male", "female"].forEach((gender, i) => {
      chartGroup
        .selectAll(`.point-${gender}`)
        .data(lineData)
        .enter()
        .append("circle")
        .attr("class", `point-${gender}`)
        .attr("cx", d => xScale(d.year))
        .attr("cy", d => yScale(d[gender]))
        .attr("r", 5)
        .attr("fill", i === 0 ? "#007BFF" : "#FF5733") // Blue for males, orange for females
        .on("mouseover", (event, d) => {
          tooltip.style("opacity", 1)
            .html(`
              <strong>Year:</strong> ${d.year}<br>
              <strong>${gender === "male" ? "Male" : "Female"}:</strong> ${d[gender]}
            `)
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY}px`);
        })
        .on("mouseout", () => tooltip.style("opacity", 0));
    });
  
    // Add legend
    const legend = chartGroup.append("g")
      .attr("transform", `translate(${chartWidth - 100}, 20)`);
  
    const legendData = [
      { label: "Male", color: "#007BFF" },
      { label: "Female", color: "#FF5733" },
    ];
  
    legend.selectAll(".legend-item")
      .data(legendData)
      .enter()
      .append("g")
      .attr("class", "legend-item")
      .attr("transform", (_, i) => `translate(0, ${i * 30})`)
      .each(function(d) {
        d3.select(this)
          .append("rect")
          .attr("width", 20)
          .attr("height", 20)
          .attr("fill", d.color);
  
        d3.select(this)
          .append("text")
          .attr("x", 30)
          .attr("y", 15)
          .text(d.label)
          .style("font-size", "14px")
          .style("alignment-baseline", "middle");
      });
  }
  
  
  
  
});
