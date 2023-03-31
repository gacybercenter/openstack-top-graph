function handleFileSelect(event) {                      // Define a function to handle file selection.

    const file = event.target.files[0];                 // Get the selected file.

    const isYaml = file.name.endsWith(".yaml")          // Check if the file is in YAML or JSON format.
        || file.name.endsWith(".yml");
    const fileType = isYaml ? "yaml" : "json";

    const reader = new FileReader();                    // Create a new FileReader object to read the contents of the file.

    reader.onload = function (event) {                  // Set up a callback function to handle the file load event.
        try {
            const fileContent = event.target.result;    // Get the file contents from the FileReader object.
            const parsedContent = fileType === "yaml"   // Parse the file contents based on the file type.
                ? jsyaml.load(fileContent)
                : JSON.parse(fileContent);

            nodesAndLinks = nodeMap(parsedContent);     // Construct a node map based on the parsed content.

            drawNodes(nodesAndLinks);

            // console.log(parsedContent);                 // Log the parsed content to the console for debugging purposes.
        } catch (error) {                               // If there was an error parsing the file, log the error to the console.
            console.error(`Error parsing ${fileType} file: ${error}`);
        }
    };
    reader.readAsText(file, "UTF-8");                   // Read the file as text using UTF-8 encoding.
}
const fileInput = document.getElementById("file-input");
fileInput.addEventListener("change", handleFileSelect, false);


function nodeMap(parsedContent) {
    // Separate the parsed JSON or YAML heat templates into a node map.
    // Requires: JSON or YAML
    // Returns: A node map of the devices
    const root = { name: "openstack", type: "Root" };
    const nodes = [root];
    const links = [];

    var title = parsedContent.description;

    if (parsedContent.parameters.range_id) {
        title = parsedContent.parameters.range_id.default
    }

    for (const [resourceName, resource] of Object.entries(parsedContent.resources)) {
        const name = `${resourceName}`;
        const type = resource.type.split("::")[2];
        const data = resource.properties;

        const node = { name, type, data };
        nodes.push(node);

        if (type === 'Router') {
            links.push({ source: node, target: root });
        }
    }
    for (const [resourceName, resource] of Object.entries(parsedContent.resources)) {
        const processProperty = (property, parentResourceName) => {
            if (typeof property === 'object') {
                if (property['get_resource'] !== undefined) {
                    const target = nodes.find(n => n.name === parentResourceName);
                    const source = nodes.find(n => n.name === property['get_resource']);
                    if (source.type !== 'Net' || target.type !== 'Port') {
                        links.push({ source, target });
                    }
                }
                for (const [key, value] of Object.entries(property)) {
                    processProperty(value, parentResourceName);
                }
            }
        }

        for (const [propertyName, property] of Object.entries(resource.properties)) {
            processProperty(property, resourceName);
        }
    }
    return { nodes, links, title };
}

function drawNodes(nodesAndLinks) {
    //  Draws a network diagram from a node map.
    //  Requires: A node map
    //  Returns: The network map the node map represents

    const nodes = nodesAndLinks.nodes;
    const links = nodesAndLinks.links;
    const title = nodesAndLinks.title;

    const uniqueNodeTypes = [...new Set(nodes.map(node => node.type))];
    const colors = ['#000000', '#c1d72e', '#9a9b9d', '#50787f', '#636467', '#dc582a', 
                    '#003359 ', '#A5ACAF', '#3CB6CE', '#00AEEF', '#64A0C8', '#44D62C'];
    const legendData = uniqueNodeTypes.map((type, i) => ({ type, color: colors[i] }));

    const colorScale = (function () {
        const domain = uniqueNodeTypes;
        const range = colors;
        const scale = {};
        domain.forEach((value, i) => {
            scale[value] = range[i];
        });
        return function (type) {
            return scale[type];
        };
    })();

    const force = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id))
        .force("charge", d3.forceManyBody().strength(-1500))
        .force("center", d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
        .force("x", d3.forceX())
        .force("y", d3.forceY())
        .on("tick", update);

    const svg = d3.select('body')
        .append('svg')
        .attr('width', window.innerWidth)
        .attr('height', window.innerHeight);

    const linksGroup = svg.append('g')
        .attr('stroke', '#000000')
        .attr('stroke-width', 2)
        .selectAll('line')
        .data(links)
        .join('line');

    const tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('position', 'absolute')
        .style('visibility', 'hidden')
        .style('background-color', '#fff')
        .style('border-radius', '4px')
        .style('box-shadow', '0 2px 5px rgba(0, 0, 0, 0.3)')
        .style('padding', '10px')
        .style('font-size', '14px')
        .style('pointer-events', 'none')
        .style('line-height', '1.4')
        .style('max-width', '300px')
        .style('text-align', 'center');

    console.log(nodes[1].data)

    const circles = svg.selectAll('circle')
        .data(nodes)
        .join('circle')
        .attr('r', d => d.type == 'Root' ? 40 : 30)
        .attr('fill', d => colorScale(d.type))
        .on('mouseenter', (event, d) => {
            const tooltip = d3.select('.tooltip');
            tooltip.html(`<p><strong>${d.name} (${d.type})</strong></p>${formatObject(d.data)}`);
            tooltip.style('visibility', 'visible')
                .style('text-align', 'left');
        })
        .on('mousemove', (event) => {
            const tooltip = d3.select('.tooltip');
            tooltip.style('top', (event.pageY + 10) + 'px');
            tooltip.style('left', (event.pageX - (tooltip.node().getBoundingClientRect().width / 2)) + 'px');
        })
        .on('mouseleave', () => {
            const tooltip = d3.select('.tooltip');
            tooltip.style('visibility', 'hidden');
        })
        .call(drag(force));

    function formatObject(obj, key = '', indent = 0, parentKey = '') {
        let html = '';
        if (Array.isArray(obj)) {
            obj.forEach((value) => {
                if (value !== '' && value !== '.')
                    html += formatObject(value, `${key}`, indent + 2, parentKey);
            });
        } else if (typeof obj === 'object' && obj !== null) {
            for (const [objKey, value] of Object.entries(obj)) {
                const currentKey = objKey === 'get_resource' ? parentKey : objKey;
                if (currentKey !== 'template' && currentKey !== 'get_param' && currentKey !== 'user_data_format' && currentKey !== 'list_join') {
                    html += formatObject(value, currentKey, indent + 2, currentKey);
                } else if (currentKey === 'list_join') {
                    html += formatObject(value, parentKey, indent + 2, parentKey);
                }
            }
        } else {
            if (key !== '' && key !== undefined) {
                html += `<strong>${key}: </strong>${obj}<br/>`;
            }
        }
        return html;
    }

    const names = svg.selectAll('text')
        .data(nodes)
        .join('text')
        .text(d => d.name)
        .attr('fill', 'black')
        .attr('text-anchor', 'middle')
        .attr('dy',  d => d.type == 'Root' ? 50 : 40)
        .style('font-family', "Verdana, Helvetica, Sans-Serif")
        .style('font-size', 12)
        .style('pointer-events', 'none');

    const titleMaxWidth = window.innerWidth / 1.5;

    const top = svg.append('text')
        .text(title)
        .attr('x', window.innerWidth / 2)
        .attr('y', 30)
        .attr('fill', 'black')
        .attr('text-anchor', 'middle')
        .style('font-family', "Verdana, Helvetica, Sans-Serif")
        .style('font-size', 32)
        .attr('textLength', function () {
            const length = this.getComputedTextLength();
            return length > titleMaxWidth ? titleMaxWidth : length;
        })
        .attr('lengthAdjust', 'spacingAndGlyphs')
        .attr('title', title);

    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", "translate(50, 10)");

    legend.selectAll("rect")
        .data(legendData)
        .enter()
        .append("rect")
        .attr("x", 10)
        .attr("y", (d, i) => i * 30 + 0)
        .attr("width", 20)
        .attr("height", 20)
        .attr("fill", d => d.color)

    legend.selectAll("text")
        .data(legendData)
        .enter()
        .append("text")
        .attr("x", 40)
        .attr("y", (d, i) => i * 30 + 15)
        .text(d => d.type)
        .style("font-size", "16px")
        .style("fill", "#333");

    function update() {
        circles.attr('cx', d => d.x)
            .attr('cy', d => d.y);

        names.attr('x', d => d.x)
            .attr('y', d => d.y);

        linksGroup.attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
    }

    function drag(simulation) {
        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }

        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;

            const tooltip = d3.select('.tooltip');
            tooltip.style('visibility', 'hidden');
        }

        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }

        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }
}
