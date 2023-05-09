import {
    getParam,
    strReplace,
    getFile,
    listJoin
} from "./modules/hotFunctions.js";

import {
    formatDataToText,
    formatObject,
    IpFromHtml
} from "./modules/nodeFunctions.js";

import {
    createSGNode
} from "./modules/parseFunctions.js";

import {
    replaceIndex
} from "./modules/utilityFunctions.js";

const fileInput = document.getElementById("file-input");
const textInput = document.getElementById("text-input");

fileInput.addEventListener("change", handleFileSelect, false);
textInput.addEventListener("change", handleTextSelect, false);

/**
 * Processes files inputed into the file container.
 * Can process YAML and JSON Heat Template files.
 * Turns a Heat Template into an interactive topological network graph
 * @param {object} event - The inputted JAML or JSON Heat Template file
 */
function handleFileSelect(event) {
    try {
        const file = event.target.files[0];                                                 // Get the selected file.
        const isYaml = file.name.endsWith(".yaml")                                          // Check if the file is in YAML or JSON format.
            || file.name.endsWith(".yml");
        const fileType = isYaml ? "yaml" : "json";

        const reader = new FileReader();                                                    // Create a new FileReader object to read the contents of the file.

        reader.onload = function (event) {                                                  // Set up a callback function to handle the file load event.
            const fileContent = event.target.result;                                        // Get the file contents from the FileReader object.
            const parsedContent = fileType === "yaml"                                       // Parse the file contents based on the file type.
                ? jsyaml.load(fileContent)
                : JSON.parse(fileContent);

            const name = file.name.split('.')[0];
            parsedContent.parameters['OS::stack_name'] = { type: 'string', default: name };

            var templateObj = getParam(parsedContent);
            templateObj = getFile(templateObj);
            templateObj = strReplace(templateObj);
            templateObj = listJoin(templateObj);

            const nodesAndLinks = nodeMap(templateObj,                                      // Construct a node map based on the parsed content.
                name);

            drawNodes(nodesAndLinks, templateObj.description);
        };
        reader.readAsText(file, "UTF-8");                                                   // Read the file as text using UTF-8 encoding.
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

/**
 * Processes text inputed into the text container.
 * Can process YAML and JSON Heat Template text.
 * Turns a Heat Template into an interactive topological network graph
 * @param {object} event - The inputted JAML or JSON Heat Template text
 */
function handleTextSelect(event) {
    try {
        const inputText = event.target.value;
        if (!inputText) {
            return;
        }

        let parsedContent = jsyaml.safeLoad(inputText) || JSON.parse(inputText);

        const parent = document.querySelector('svg');
        if (parent) {
            while (parent.firstChild) {
                parent.removeChild(parent.firstChild);
            }
        }

        const file = { name: "TEMPLATE" }
        parsedContent.parameters['OS::stack_name'] = { type: 'string', default: file.name };

        var templateObj = getParam(parsedContent);
        templateObj = getFile(templateObj);
        templateObj = strReplace(templateObj);
        templateObj = listJoin(templateObj);

        const nodesAndLinks = nodeMap(templateObj,                                      // Construct a node map based on the parsed content.
            file.name);

        drawNodes(nodesAndLinks, templateObj.description);
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

/**
 * Parses through the data extracting information like: nodes, links, and the title.
 * It also duplicates attached security groups and adds a root node.
 * @param {object} parsedContent - The parsed JAML or JSON
 * @param {object} name - The JAML or JSON file name
 * @returns {object} - The { nodes, links, amounts, title, and parameters }
 */
function nodeMap(parsedContent, name) {
    const root = { name: "openstack", type: "Root" };
    const amounts = { Root: 1 };
    const nodes = [root];
    const links = [];
    const sgNodes = [];

    let title = name || "No name found.";

    const svg = document.querySelector('svg');
    const tooltip = document.querySelector('.tooltip');
    if (svg) { svg.remove(); }
    if (tooltip) { tooltip.remove(); }

    function createNode(resourceName, resource, count = 0) {
        const name = resourceName;
        const type = resource.type.split("::")[2];
        const data = resource.properties;
        const node = { name, type, data };
        amounts[type] = (amounts[type] || 0) + 1;

        switch (type) {                                                                 // Handle different node types.
            case 'SecurityGroup':
            case 'SoftwareConfig':
                sgNodes.push(node);
                break;
            case 'ResourceGroup':
                for (const [property_name, property] of Object.entries(data)) {        // Find the `count` property and set `count` to its value.
                    if (property_name === "count") {
                        count = property;
                        break;
                    }
                }
                for (const [propertyName, property] of Object.entries(data)) {         // Create nodes for each resource in `resource_def`.
                    if (propertyName === "resource_def") {
                        for (let index = 1; index <= count; index++) {
                            let newProp = replaceIndex(property, index);
                            let newName = newProp.properties.name;
                            if (newName === property.properties.name) {
                                newName = property.properties.name + '_' + index;
                            }
                            createNode(newName, newProp);
                        }
                    }
                }
                break;
            default:
                nodes.push(node);
                break;
        }
        if (type === 'Router') {
            links.push({ source: node, target: root });
        }
    }

    function createLink(property, parentResourceName) {
        if (Array.isArray(property)) {
            for (const element of property) {
                createLink(element, parentResourceName);
            }
        } else if (typeof property === 'object') {
            if (property.get_resource !== undefined || property.port !== undefined) {
                const target = nodes.find(n => n.name === parentResourceName);
                const sourceName = property.get_resource || property.port;
                const source = sgNodes.find(n => n.name === sourceName) || nodes.find(n => n.name === sourceName);
                if (source && target) {
                    if (target.type === 'RouterInterface' && source.type === 'Subnet') {
                        target.data['fixed_ip'] = source.data['gateway_ip'];
                    }
                    if (source.type !== 'Net' || target.type !== 'Port') {
                        links.push({ source, target });
                    }
                }
            }
            for (const [key, value] of Object.entries(property)) {
                createLink(value, parentResourceName);
            }
        }
    }

    for (const [resourceName, resource] of Object.entries(parsedContent.resources)) {
        if (resource !== undefined) {
            createNode(resourceName, resource);
        }
    }

    for (const node of nodes) {
        if (node.data) {
            for (const [propertyName, property] of Object.entries(node.data)) {
                createLink(property, node.name);
            }
        }
    }

    console.log(nodes);

    if (sgNodes) {
        for (const sgNode of sgNodes) {
            createSGNode(sgNode, nodes, links, amounts);
        }
    }

    return { nodes, links, amounts, title, parameters: parsedContent.parameters };
}

/**
* Takes in a an object of nodes, links, and titles.
* Generates a node map using d3 v7 and html.
* @param {object} nodesAndLinks - The { nodes, links, amounts, title, and parameters }
* @param {string} description - The Node Map's description pulled from the YAML/JSON
*/
function drawNodes(nodesAndLinks, description) {
    const nodes = nodesAndLinks.nodes;                                                  // Separates the nodes from the input
    const links = nodesAndLinks.links;                                                  // Separates the links from the input
    const amounts = nodesAndLinks.amounts                                               // Separates the amounts from the input

    const title = nodesAndLinks.title;                                             // Separates the title from the input

    const width = window.innerWidth                                                     // Stores the window width
    const height = window.innerHeight                                                   // Stores the window height

    const parameters = formatDataToText(nodesAndLinks.parameters);                      // Separates the heat template information from the input
    for (var node of nodes) {
        node.info = formatObject(node.data);                                            // Adds each node's data to itself as html
        node.ip = IpFromHtml(node.info);                                                // Adds each node's IP address from the html
    }

    console.log(node.info);

    const uniqueNodeTypes = [...new Set(nodes.map(node => node.type))];                 // Recores the unique node types in an array
    const colors = ['#000000', '#c1d72e', '#9a9b9d', '#50787f', '#636467', '#dc582a',   // Defines GCC and AU colors
        '#003359 ', '#A5ACAF', '#3CB6CE', '#00AEEF', '#64A0C8', '#44D62C']

    const legendData = uniqueNodeTypes.map((type, i) => ({                              // Assign a GCC and AU color and count to legend data
        type,
        count: amounts[type],
        color: colors[i % colors.length]
    }));

    const colorScale = (function () {                                                   // Assign a GCC and AU color to each node
        const domain = uniqueNodeTypes;
        const range = colors;
        const scale = {};
        domain.forEach((value, i) => {
            scale[value] = range[i % colors.length];
        });
        return function (type) {
            return scale[type];
        };
    })();

    const pictures = {                                                                  // Assign each node type an icon
        'Root': "./assets/img/favicon.ico",
        'Net': "./assets/img/os__neutron__net.svg",
        'Subnet': "./assets/img/os__neutron__subnet.svg",
        'Router': "./assets/img/os__neutron__router.svg",
        'RouterInterface': "./assets/img/os__neutron__routerinterface.svg",
        'Server': "./assets/img/os__nova__server.svg",
        'Port': "./assets/img/os__neutron__port.svg",
        'FloatingIP': "./assets/img/os__neutron__floatingip.svg",
        'FloatingIPAssociation': "./assets/img/os__neutron__floatingipassociation.svg",
        'ResourceGroup': "./assets/img/os__heat__resourcegroup.svg",
        'SecurityGroup': "./assets/img/os__neutron__securitygroup.svg",
        'ExtraRoute': "./assets/img/extraroute.svg",
        'WaitCondition': "./assets/img/waitcondition.svg",
        'WaitConditionHandle': "./assets/img/waitconditionhandle.svg",
        'MultipartMime': "./assets/img/multipartmime.svg",
        'SoftwareConfig': "./assets/img/softwareconfig.svg",
        'RandomString': "./assets/img/randomstring.svg",
        'RecordSet': "./assets/img/recordset.svg",
        'Zone': "./assets/img/zone.svg",
        'Other': "./assets/img/question__mark.png"
    }

    const weights = {                                                                   // Assign each node type a weight
        'Root': 10,
        'Net': 10,
        'Subnet': 16,
        'Router': 14,
        'RouterInterface': 7,
        'Server': 10,
        'Port': 7,
        'FloatingIP': 8,
        'FloatingIPAssociation': 6,
        'ResourceGroup': 10,
        'SecurityGroup': 6,
        'ExtraRoute': 7,
        'WaitCondition': 6,
        'WaitConditionHandle': 10,
        'MultipartMime': 10,
        'SoftwareConfig': 5,
        'RandomString': 5,
        'RecordSet': 5,
        'Zone': 7,
        'Other': 8
    };

    const force = d3.forceSimulation(nodes)                                             // Start a force simulation that updates every tick
        .force("link", d3.forceLink(links).id(d => d.id))
        .force("charge", d3.forceManyBody()
            .strength(d => weights[d.type] * -150 || weights.Other * -150))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("x", d3.forceX())
        .force("y", d3.forceY())
        .on("tick", update);

    const zoom = d3.zoom()                                                              // Define the zoom function
        .scaleExtent([0.25, 4])
        .on('zoom', zoomed);

    const svg = d3.select('body')                                                       // Define the main svg body for the topology
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr("cursor", "crosshair")
        .call(zoom);

    const subnetGroups = svg.selectAll('.subnet-group')                                 // Add Subnet nodes to a group
        .data(nodes.filter(d => d.type === 'Subnet'))
        .join('g')
        .attr('class', 'subnet-group');

    const perimeterPaths = subnetGroups.selectAll('.perimeter-path')                    // Bind each subnet node to its own group
        .data(d => [d])
        .join('path')
        .attr('class', 'perimeter-path')
        .attr('fill', d => colorScale(d.type))
        .attr('fill-opacity', 0.2)

    function drawPerimeter(subnetNode, depth = 3, paddingAngle = 20) {                  // Draw a hull encompassing Subnet nodes and their connections
        const linkedNodes = getLinkedNodes(subnetNode, depth);                          // Recusivly finds all nodes linked to the subnet
        const perimeterNodes = [subnetNode, ...linkedNodes];                            // Adds all subnet elements to an array
        const hull = d3.polygonHull(perimeterNodes.map(node => [node.x, node.y]));      // Constructs the hull based on the perimeter nodes
        if (!hull) {                                                                    // Creates a null hull if there are no perimeter nodes
            perimeterPaths.filter(d => d === subnetNode).attr("d", "");
            return;
        }
        const centroid = d3.polygonCentroid(hull);
        const paddedHull = hull.map(point => {                                          // Adds a buffer region using the hull centroid and an angle
            const angle = Math.atan2(point[1] - centroid[1], point[0] - centroid[0]);
            return [
                point[0] + paddingAngle * Math.cos(angle),
                point[1] + paddingAngle * Math.sin(angle)
            ];
        });
        const expandedHull = paddedHull.map(point => point.join(',')).join(' ');
        perimeterPaths.filter(d => d === subnetNode).attr("d", `M${expandedHull}Z`);
        /**
         * Recursivly finds all nodes with a the input as a source.
         * @param {string} node - The starting node object
         * @param {object} depth - The function search depth
         * @returns {string} - An array containing the connected node objects
         */
        function getLinkedNodes(node, depth) {
            if (depth === 0) return [];
            const linked = nodes.filter(n =>
                n !== node &&
                links.some(link =>
                    (node === link.source && n === link.target)
                )
            );
            return linked.reduce((result, n) => {
                if (!result.includes(n)) {
                    result.push(n);
                    result = result.concat(getLinkedNodes(n, depth - 1));
                }
                return result;
            }, []);
        }
    }

    const linksGroup = svg.append('g')                                              // Define the links between nodes 
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('stroke-width', 2)
        .attr('stroke', d => colorScale(d.source.type))
        .attr("stroke-opacity", 0.75);

    const nodesGroup = svg.append('g')                                              // Define the nodes with color, tooltips, and drag properties
        .selectAll('circle')
        .data(nodes)
        .join('circle')
        .attr('r', d => weights[d.type] * 2.5 || weights.Other * 2.5)
        .attr('fill', d => colorScale(d.type))
        .on('mouseenter', (event, d) => {
            const tooltip = d3.select('.tooltip');
            if (tooltips) {
                tooltip.style('max-width', width / 4 + 'px'),
                tooltip.html(`<p><strong>${d.name} (${d.type})</strong></p>${d.info.long}`);
            } else {
                tooltip.style('max-width', width / 5 + 'px');
                tooltip.html(`<p><strong>${d.name} (${d.type})</strong></p>${d.info.short}`);
            }
            tooltip.style('visibility', 'visible');
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

    const imageGroup = svg.append('g')                                              // Define the node icons
        .selectAll('image')
        .data(nodes)
        .join('image')
        .attr('xlink:href', d => pictures[d.type] || pictures.Other)
        .attr('width', d => weights[d.type] * 4 || weights.Other * 4)
        .attr('height', d => weights[d.type] * 4 || weights.Other * 4)
        .attr('x', d => d.x - weights[d.type] * 2 || d.x - weights.Other * 2)
        .attr('y', d => d.y - weights[d.type] * 2 || d.y - weights.Other * 2)
        .style('pointer-events', 'none');

    const textGroup = svg.append('g')                                               // Define the node text
        .selectAll('text')
        .data(nodes)
        .join('text')
        .text(d => d.name)
        .attr('fill', 'black')
        .attr('text-anchor', 'middle')
        .attr('dy', d => weights[d.type] * 4 || weights.Other * 4)
        .style('font-family', "Verdana, Helvetica, Sans-Serif")
        .style('font-size', d => weights[d.type] * 1.25 || weights.Other * 1.25)
        .style('pointer-events', 'none');

    const tooltip = d3.select('body')                                               // Define the tooltips
        .append('div')
        .attr('class', 'tooltip')
        .style('position', 'absolute')
        .style('visibility', 'hidden')
        .style('background-color', '#fff')
        .style('border-radius', '4px')
        .style('box-shadow', '0 2px 5px rgba(0, 0, 0, 0.3)')
        .style('padding', '7px')
        .style('font-size', '14px')
        .style('pointer-events', 'none')
        .style('line-height', '1.4')
        .style('text-align', 'left')
        .style('word-wrap', 'break-word');

    const titleMaxWidth = width / 1.5;                                             // Set limits on the title width

    const top = svg.append('text')                                                  // Define the title
        .text(title)
        .attr('x', width / 2)
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

    const legend = svg.append("g")                                                  // Define the legend
        .attr("class", "legend")
        .attr("transform", "translate(10, 10)")
        .style('visibility', 'visible');

    legend.selectAll("rect")                                                        // Add colors to the legend
        .data(legendData)
        .enter()
        .append("rect")
        .attr("x", 10)
        .attr("y", (d, i) => i * 30 + 0)
        .attr("width", 20)
        .attr("height", 20)
        .attr("fill", d => d.color);

    legend.selectAll("text")                                                         // Add text to the legend
        .data(legendData)
        .enter()
        .append("text")
        .attr("x", 40)
        .attr("y", (d, i) => i * 30 + 15)
        .text(d => `${d.type} (${d.count})`)
        .style("font-size", "16px")
        .style("fill", "#333");

    const descriptionMaxWidth = width / 4;

    const info = svg.append("g") // create a new group element
        .attr("class", "info")
        .attr("transform", "translate(" + (width * 3 / 4 - 20) + ", 30)");

    info.append("text")
        .text(description)
        .style("font-size", "16px")
        .style("fill", "#333")
        .style("text-decoration", "underline")
        .attr("textLength", function () {
            const length = this.getComputedTextLength();
            return length > descriptionMaxWidth ? descriptionMaxWidth : length;
        })
        .attr("lengthAdjust", "spacingAndGlyphs")
        .append("title")
        .text(description);

    const textLines = parameters.split("\n");

    info.append("rect") // add a rectangle for the background
        .attr("x", 0)
        .attr("y", 10)
        .attr("width", descriptionMaxWidth)
        .attr("height", textLines.length * 16 + 30) // adjust the height based on the number of lines
        .style("fill", "#fff")
        .style("stroke", "#333")
        .style("stroke-width", "1px")

    const text = info.append("text") // add the text content
        .attr("x", 10)
        .attr("y", 20)
        .style("font-size", "12px")
        .style("line-height", "1.2")
        .style("text-align", "left");

    text.selectAll("tspan")
        .data(textLines)
        .enter()
        .append("tspan")
        .text((d) => d)
        .attr("x", 10)
        .attr("dy", "1.4em"); // adjust the line spacing    

    var was_locked = false;
    function toggleLock() {                                                         // Lockes the nodes in place if toggled
        nodesGroup.each(function (d) {
            d.locked = !d.locked;
            if (d.locked) {
                d.fx = d.x;
                d.fy = d.y;
            } else {
                d.fx = null;
                d.fy = null;
            }
        });
        if (force) {
            force.alphaTarget(0.1).restart();
        }
    }

    function update() {                                                             // Run by the force simulation every tick
        nodesGroup.attr('cx', d => d.x)                                             // Updates the node positions
            .attr('cy', d => d.y);

        imageGroup.attr('x', d => d.x - weights[d.type] * 2                         // Updates the icon positions
            || d.x - weights.Other * 2)
            .attr('y', d => d.y - weights[d.type] * 2
                || d.y - weights.Other * 2);

        textGroup.attr('x', d => d.x)                                               // Updates the text positions
            .attr('y', d => d.y)
            .text(d => {
                if (ips) {                                                          // Updates the Show IPs state
                    return d.ip;
                } else {
                    return d.name;
                }
            });

        linksGroup.attr('x1', d => d.source.x)                                      // Updates the link positions
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        if (was_locked !== locked) {                                                // Updates the Lock Nodes state
            toggleLock();
            was_locked = locked;
        }

        if (subnet) {                                                               // Updates the Show Subnets state
            subnetGroups.each(function (d) {
                drawPerimeter(d);
            });
            if (force) {
                force.alphaTarget(0.1).restart();
            }
        } else {
            perimeterPaths.attr("d", "");
            if (force) {
                force.alphaTarget(0.1).restart();
            }
        }

        if (showInfo) {
            info.style('visibility', 'visible');
        } else {
            info.style('visibility', 'hidden');
        }

        if (hideLegend) {
            legend.style('visibility', 'hidden');
        } else {
            legend.style('visibility', 'visible');
        }
    }

    function zoomed(event) {                                                        // Define the zoomed function to account for space changing
        const { transform } = event;

        subnetGroups.attr('transform', transform);
        linksGroup.attr('transform', transform);
        nodesGroup.attr('transform', transform);
        imageGroup.attr('transform', transform);
        textGroup.attr('transform', transform);
    }

    function drag(simulation) {                                                     // Manages the drag actions, called by nodes
        let x, y, dx, dy;

        function dragstarted(event) {                                               // Manages the begining of a drag
            if (!event.active) simulation.alphaTarget(0.3).restart();

            x = event.subject.x;
            y = event.subject.y;

            event.subject.fx = x;
            event.subject.fy = y;
        }

        function dragged(event) {                                                   // Manages the middle of a drag

            const transform = d3.zoomTransform(svg.node());

            dx = transform.invertX(event.x) - transform.invertX(x);
            dy = transform.invertY(event.y) - transform.invertY(y);

            event.subject.fx = x + dx;
            event.subject.fy = y + dy;

            const tooltip = d3.select(".tooltip");
            tooltip.style("visibility", "hidden");
        }

        function dragended(event) {                                                 // Manages the end of a drag
            if (!event.active) simulation.alphaTarget(0);

            if (!locked) {
                event.subject.fx = null;
                event.subject.fy = null;
            }
        }
        return d3.drag()                                                            // Chooses the drag phase
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }
}
