import {
    replaceIndex,
    formatObject,
    IpFromHtml
} from "./modules/parseFunctions.js";

import {
    clearSVG,
    getFileType,
    parseFile,
    getTemplateName,
    resolveIntrinsicFunctions,
    parseInputText,
    setTemplateName,
    setConsoleHost,
    createDuplicateNodes
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
        clearSVG();

        const file = event.target.files[0];
        const fileType = getFileType(file.name);

        const reader = new FileReader();
        reader.onload = handleFileLoad(fileType, file.name, reader);

        reader.readAsText(file, "UTF-8");
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

/**
 * Returns a function that handles a file load event by parsing the file content,
 * setting the console host, resolving intrinsic functions, mapping nodes and links,
 * and drawing these nodes and links.
 *
 * @param {string} fileType - the type of the loaded file.
 * @param {string} fileName - the name of the loaded file.
 * @param {FileReader} reader - the FileReader object used to read the file.
 * @return {function} a function that handles a file load event.
 */
function handleFileLoad(fileType, fileName, reader) {
    return function (event) {
        const fileContent = event.target.result;
        const parsedContent = parseFile(fileType, fileContent);
        const templateName = getTemplateName(fileName);

        setConsoleHost(parsedContent.parameters);
        setTemplateName(parsedContent, templateName);

        const templateObj = resolveIntrinsicFunctions(parsedContent);
        const nodesAndLinks = nodeMap(templateObj, templateName);

        drawNodes(nodesAndLinks, templateObj.description);
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
        clearSVG();

        const inputText = event.target.value;
        if (!inputText) return;

        const parsedContent = parseInputText(inputText);

        const file = { name: 'TEMPLATE' };
        if (parsedContent.parameters) {
            parsedContent.parameters['OS::stack_name'] = {
                type: 'string',
                default: file.name,
            };
        }

        setConsoleHost(parsedContent.parameters);

        const templateObj = resolveIntrinsicFunctions(parsedContent);
        const nodesAndLinks = nodeMap(templateObj, file.name);

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
    const root = { name: "cloud", type: "Root" };                                       // Initialize the data structures.
    const amounts = { Root: 1 };
    const nodes = [root];
    const links = [];
    const duplicateNodes = [];

    let title = name || "No name found.";

    /**
     * Creates a node object based on the given resource and resource name, 
     * and adds it to the appropriate list of nodes. The function also handles 
     * special cases for certain node types and adds links if the node is a 
     * Router. 
     *
     * @param {string} resourceName - The name of the resource to be created.
     * @param {object} resource - The resource object containing data for the new node.
     * @param {number} [count=0] - The number of nodes to create if the resource is a ResourceGroup.
     */
    function createNode(resourceName, resource, count = 0) {
        const name = resourceName;
        const type = resource.type.split("::")[2] || resource.type;
        const data = resource.properties;
        const node = { name, type, data };
        amounts[type] = (amounts[type] || 0) + 1;

        switch (type) {                                                                 // Handle different node types.
            case 'SecurityGroup':
            case 'SoftwareConfig':
            case 'RandomString':
                duplicateNodes.push(node);
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

    /**
     * Given a property and a parent resource name, this function searches for a
     * resource that matches the given property and links it to the parent resource.
     *
     * @param {object | array} property - The property to search for.
     * @param {string} parentResourceName - The name of the parent resource to link
     * the property to.
     */
    function getResource(property, parentResourceName) {
        if (typeof property === 'object') {
            if (property.get_resource !== undefined || property.port !== undefined) {
                const target = nodes.find(n => n.name === parentResourceName);
                const sourceName = property.get_resource || property.port;
                const source = duplicateNodes.find(n => n.name === sourceName) || nodes.find(n => n.name === sourceName);
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
                getResource(value, parentResourceName);
            }
        } else if (Array.isArray(property)) {
            for (const element of property) {
                getResource(element, parentResourceName);
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
                getResource(property, node.name);
            }
        }
    }

    if (duplicateNodes) {
        for (const duplicateNode of duplicateNodes) {
            createDuplicateNodes(duplicateNode, nodes, links, amounts);
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

    const title = nodesAndLinks.title;                                                  // Separates the title from the input

    const width = window.innerWidth                                                     // Stores the window width
    const height = window.innerHeight                                                   // Stores the window height
    var container = document.getElementsByClassName('container')[0];
    var heightOffset = container.offsetHeight;

    const parameters = nodesAndLinks.parameters;                      // Separates the heat template information from the input
    for (var node of nodes) {
        node.info = formatObject(node.data);                                            // Adds each node's data to itself as html
        node.ip = IpFromHtml(node.info.long);                                           // Adds each node's IP address from the html
    }

    /**
     * Generates a color scale function that maps node types to colors.
     *
     * @param {array} domain - A list of unique node types
     * @param {array} range - A list of colors to map to each node type
     * @returns {function} - A color scale function that maps node types to colors
     */
    function generateColorScale(domain, range) {
        const scale = {};
        domain.forEach((value, i) => {
            scale[value] = range[i % range.length];
        });
        return function (type) {
            return scale[type];
        };
    }

    const colors = [
        '#c1d72e',
        '#000000',
        '#9a9b9d',
        '#50787f',
        '#636467',
        '#dc582a',
        '#003359',
        '#A5ACAF',
        '#3CB6CE',
        '#00AEEF',
        '#64A0C8',
        '#44D62C',
        '#ff0000', // red
        '#ffa500', // orange
        '#ffff00', // yellow
        '#008000', // green
        '#4b0082', // indigo
        '#ee82ee', // violet
    ];

    const uniqueNodeTypes = [...new Set(nodes.map(node => node.type))];
    const colorScale = generateColorScale(uniqueNodeTypes, colors);

    const legendData = uniqueNodeTypes.map(type => ({
        type,
        count: amounts[type],
        color: colorScale(type)
    }));

    const subnetColors = [
        '#ff0000', // red
        '#ffa500', // orange
        '#ffff00', // yellow
        '#008000', // green
        '#0000ff', // blue
        '#4b0082', // indigo
        '#ee82ee', // violet
        '#00ffff', // cyan
        '#ff00ff', // magenta
        '#00ff00', // lime
        '#000000', // black
    ];

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
        'Net': 8,
        'Subnet': 12,
        'Router': 10,
        'RouterInterface': 6,
        'Server': 10,
        'Port': 7,
        'FloatingIP': 5,
        'FloatingIPAssociation': 5,
        'ResourceGroup': 10,
        'SecurityGroup': 5,
        'ExtraRoute': 7,
        'WaitCondition': 5,
        'WaitConditionHandle': 10,
        'MultipartMime': 8,
        'SoftwareConfig': 5,
        'RandomString': 5,
        'RecordSet': 5,
        'Zone': 8,
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
        .scaleExtent([0.2, 5])
        .on('zoom', zoomed);

    const svg = d3.select('body')                                                       // Define the main svg body for the topology
        .append('svg')
        .attr('width', width * 0.98)
        .attr('height', (height - heightOffset) * 0.95)
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
        .attr('fill', d => subnetColors[(d.index + 6) % subnetColors.length])
        .attr('fill-opacity', 0.25);

    /**
     * Draws a perimeter around the given subnet node and its linked nodes up to a given depth.
     *
     * @param {object} subnetNode - The node to draw a perimeter around
     * @param {number} [depth=3] - The depth to search for linked nodes
     * @param {number} [paddingAngle=20] - The angle in degrees to pad the perimeter by
     */
    function drawPerimeter(subnetNode, depth = 3, paddingAngle = 30) {
        const linkedNodes = getLinkedNodes(subnetNode, depth);
        const perimeterNodes = [subnetNode, ...linkedNodes];
        const hull = d3.polygonHull(perimeterNodes.map(node => [node.x, node.y]));
        if (!hull) {
            perimeterPaths.filter(d => d === subnetNode).attr("d", "");
            return;
        }
        const centroid = d3.polygonCentroid(hull);
        const paddedHull = hull.map(point => {
            const angle = Math.atan2(point[1] - centroid[1], point[0] - centroid[0]);
            return [
                point[0] + paddingAngle * Math.cos(angle),
                point[1] + paddingAngle * Math.sin(angle)
            ];
        });
        const expandedHull = paddedHull.map(point => point.join(',')).join(' ');
        perimeterPaths.filter(d => d === subnetNode).attr("d", `M${expandedHull}Z`);

        /**
         * Recursively finds all nodes with the input as a source.
         * @param {object} node - The starting node object
         * @param {number} depth - The function search depth
         * @returns {array} - An array containing the connected node objects
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
        .attr("stroke-opacity", 0.9);

    const nodesGroup = svg.append('g')                                              // Define the nodes with color, tooltips, and drag properties
        .selectAll('circle')
        .data(nodes)
        .join('circle')
        .attr('r', d => weights[d.type] * 2.5 || weights.Other * 2.5)
        .attr('fill', d => colorScale(d.type))
        .on('mouseenter', (event, d) => {
            const tooltip = d3.select('.tooltip');
            if (tooltips) {
                tooltip.style('max-width', width / 3 + 'px'),
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
        .attr('dy', d => weights[d.type] * 3.5 || weights.Other * 3.5)
        .style('font-family', "Verdana, Helvetica, Sans-Serif")
        .style('font-size', d => weights[d.type] * 1.1 || weights.Other * 1.1)
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

    const legend = svg.append("g")                                                  // Define the legend
        .attr("class", "legend")
        .attr("transform", "translate(10, 45)")
        .style('visibility', 'visible');

    legend.selectAll("rect")                                                        // Add colors to the legend
        .data(legendData)
        .enter()
        .append("rect")
        .attr("x", 0)
        .attr("y", (d, i) => i * 30 + 50)                                           // Adjusted y-coordinate to make room for the title
        .attr("width", 20)
        .attr("height", 20)
        .attr("fill", d => d.color);

    legend.selectAll("text")                                                         // Add text to the legend
        .data(legendData)
        .enter()
        .append("text")
        .attr("x", 30)
        .attr("y", (d, i) => i * 30 + 65)                                           // Adjusted y-coordinate to make room for the title
        .text(d => `${d.type} (${d.count})`)
        .style("font-size", "16px")
        .style("fill", "#222");

    const titleMaxWidth = width / 4;                                                // Set limits on the title width

    legend.append('text')                                                           // Define the title
        .text(title)
        .attr('fill', 'black')
        .attr('text-anchor', 'left')
        .style('font-family', "Verdana, Helvetica, Sans-Serif")
        .style('font-size', "24px")
        .attr('textLength', function () {
            const length = this.getComputedTextLength();
            return length > titleMaxWidth ? titleMaxWidth : length;
        })
        .attr('lengthAdjust', 'spacingAndGlyphs')
        .attr('title', title)
        .attr('x', 0)
        .attr('y', 30);                                                             // Modified line to adjust y-coordinate of the title

    const descriptionMaxWidth = width / 3;                                       // Set limits on the description width

    const info = svg.append("foreignObject")
        .attr("class", "info")
        .attr("x", width * (1 - 0.4))
        .attr("y", 0)
        .attr("width", descriptionMaxWidth + 50)
        .attr("height", "100%")
        .style("position", "absolute")
        .style("overflow-x", "scroll")
        .style("overflow-y", "scroll");

    const div = info.append("xhtml:div")
        .style("background-color", "#ddd")
        .style("height", "100%")
        .style("width", "100%")
        .style("padding", "8px")
        .attr('lengthAdjust', 'spacingAndGlyphs');

    const button = div.append("button")
        .text("Copy")
        .style("margin-bottom", "8px")
        .on("click", () => {
            const copyText = jsyaml.dump(parameters);
            navigator.clipboard.writeText(copyText)
                .then(() => {
                    console.log("Copied to clipboard: " + copyText);
                })
                .catch((err) => {
                    console.error("Failed to copy text: " + err);
                })
        });

    const information = div.append("p")
        .html(description)
        .style("font-size", "16px")
        .style("text-decoration", "underline")
        .style("hyphens", "auto")
        .attr('lengthAdjust', 'spacingAndGlyphs');

    const code = div.append("pre")
        .style("font-size", "12px")
        .style("line-height", "1.2")
        .style("text-align", "left")
        .style("hyphens", "auto")
        .style("background-color", "#f1f1f1")
        .style("border-radius", "8px")
        .style("padding", "8px")
        .attr('lengthAdjust', 'spacingAndGlyphs');

    code.html(jsyaml.dump(parameters));

    var wasLocked = false;

    /**
     * Toggles the locked state of the nodes and updates their position accordingly. 
     *
     * @param none
     * @return none
     */
    function toggleLock() {                                                     // Lockes the nodes in place if toggled
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

    /**
     * Updates the positions of nodes, images, text, and links based on the current
     * tick of the force simulation. Also updates the visibility of various UI
     * elements based on different states such as Show IPs, Lock Nodes, Show Subnets,
     * Show Info, Hide Legend, and Dark Mode.
     */
    function update() {
        svg.attr("width", (window.innerWidth) * 0.98)
            .attr("height", (window.innerHeight - heightOffset) * 0.95);

        nodesGroup
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);

        imageGroup
            .attr("x", d => (d.x - weights[d.type] * 2) || (d.x - weights.Other * 2))
            .attr("y", d => (d.y - weights[d.type] * 2) || (d.y - weights.Other * 2));

        textGroup
            .attr("x", d => d.x)
            .attr("y", d => d.y)
            .text(d => ips ? d.ip : d.name);

        linksGroup
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        if (wasLocked !== locked) {
            toggleLock();
            wasLocked = locked;
        }

        if (subnet) {
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

        info.style("visibility", showInfo ? "visible" : "hidden");

        legend.style("visibility", hideLegend ? "hidden" : "visible");

        textGroup.style("fill", darkMode ? "#eee" : "#111");
        legend.selectAll("text").style("fill", darkMode ? "#ddd" : "#222");
    }

    /**
     * Defines the zoomed function to account for space changing.
     *
     * @param {object} event - The event object.
     */
    function zoomed(event) {                                                        // Define the zoomed function to account for space changing
        const { transform } = event;

        subnetGroups.attr('transform', transform);
        linksGroup.attr('transform', transform);
        nodesGroup.attr('transform', transform);
        imageGroup.attr('transform', transform);
        textGroup.attr('transform', transform);
    }

    /**
     * Manages the drag actions, called by nodes.
     *
     * @param {Object} simulation - the simulation object to be used for the drag actions.
     * @return {Object} - the drag object that chooses the drag phase.
     */
    function drag(simulation) {                                                     // Manages the drag actions, called by nodes
        let x, y, dx, dy;

        /**
         * Manages the beginning of a drag.
         *
         * @param {event} event - the event object representing the drag start
         * @return {undefined} this function does not return anything
         */
        function dragstarted(event) {                                               // Manages the begining of a drag
            if (!event.active) simulation.alphaTarget(0.3).restart();

            x = event.subject.x;
            y = event.subject.y;

            event.subject.fx = x;
            event.subject.fy = y;
        }

        /**
         * Manages the middle of a drag
         *
         * @param {event} event - the event object
         * @return {void} does not return anything
         */
        function dragged(event) {                                                   // Manages the middle of a drag

            const transform = d3.zoomTransform(svg.node());

            dx = transform.invertX(event.x) - transform.invertX(x);
            dy = transform.invertY(event.y) - transform.invertY(y);

            event.subject.fx = x + dx;
            event.subject.fy = y + dy;

            const tooltip = d3.select(".tooltip");
            tooltip.style("visibility", "hidden");
        }

        /**
         * Manages the end of a drag
         *
         * @param {Object} event - the event object
         * @return {undefined}
         */
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
