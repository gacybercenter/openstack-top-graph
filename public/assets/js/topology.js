/**
 * Processes files inputed into the file container.
 * Can process YAML and JSON Heat Template files.
 * Turns a Heat Template into an interactive topological network graph
 * @param {object} event - The inputted JAML or JSON Heat Template
 */
function handleFileSelect(event) {                                                      // Define a function to handle file selection.

    const file = event.target.files[0];                                                 // Get the selected file.

    const isYaml = file.name.endsWith(".yaml")                                          // Check if the file is in YAML or JSON format.
        || file.name.endsWith(".yml");
    const fileType = isYaml ? "yaml" : "json";

    const reader = new FileReader();                                                    // Create a new FileReader object to read the contents of the file.

    reader.onload = function (event) {                                                  // Set up a callback function to handle the file load event.
        try {
            const fileContent = event.target.result;                                    // Get the file contents from the FileReader object.
            const parsedContent = fileType === "yaml"                                   // Parse the file contents based on the file type.
                ? jsyaml.load(fileContent)
                : JSON.parse(fileContent);

            nodesAndLinks = nodeMap(parsedContent, file.name);                                     // Construct a node map based on the parsed content.

            drawNodes(nodesAndLinks);

        } catch (error) {                                                               // If there was an error parsing the file, log the error to the console.
            console.error(`Error parsing ${fileType} file: ${error}`);
        }
    };
    reader.readAsText(file, "UTF-8");                                                   // Read the file as text using UTF-8 encoding.
}
const fileInput = document.getElementById("file-input");
fileInput.addEventListener("change", handleFileSelect, false);

/**
 * Parses through the data extracting information like: nodes, links, and the title.
 * It also duplicates attached security groups and adds a root node.
 * @param {object} parsedContent - the parsed JAML or JSON
 * @returns {object} - the { nodes, links, and title }
 */
function nodeMap(parsedContent, name) {

    const root = { name: "openstack", type: "Root" };                                   // Creates the root node
    const amounts = { Root: 1 };                                                        // Creates a dictionary for node amounts
    const nodes = [root];                                                               // Creates an array for nodes and adds the root node
    const links = [];                                                                   // Creates an array for links
    const sgNodes = [];                                                                 // Creates an array for duplicate security group nodes

    let title;                                                                          // Parse the title from the YAML/JSON
    try {
        if (parsedContent.parameters.range_id.default) {                                // Check for the parameter range_id.default
            title = parsedContent.parameters.range_id.default;
        }
    } catch (error) {
        try {
            if (parsedContent.description) {                                            // Check for the description
                title = parsedContent.description;
            } else {
                title = name;
            }
        } catch (error) {
            console.log("Error occurred while getting title:", error);
            title = name;
        }
    }

for (const [resourceName, resource] of Object.entries(parsedContent.resources)) {   // Itterate through all of the resources
    const name = `${resourceName}`;                                                 // Store the name
    const type = resource.type.split("::")[2];                                      // Store the type
    const data = resource.properties;                                               // Store the data (properties)

    const node = { name, type, data };                                              // Create a node object using { name, type, data }
    amounts[type] = (amounts[type] || 0) + 1;

    if (type === 'SecurityGroup') {                                                 // Add SecurityGroup nodes to the sgNodes array
        sgNodes.push(node);
    } else {                                                                        // Add all other nodes to the nodes array
        nodes.push(node);
    }

    if (type === 'Router') {                                                        // Attach all routers to the root node
        links.push({ source: node, target: root });
    }
}

for (const [resourceName, resource] of Object.entries(parsedContent.resources)) {   // Iterate through all resources
    const processProperty = (property, parentResourceName) => {                     // Add links between nodes based on what resources they get
        if (typeof property === 'object') {
            if (property['get_resource'] !== undefined) {
                const target = nodes.find(n => n.name === parentResourceName);
                const sourceName = property['get_resource'];
                const source = sgNodes.find(n => n.name === sourceName) || nodes.find(n => n.name === sourceName);
                if (source.type !== 'Net' || target.type !== 'Port') {              // Filter out all Net to Port links
                    links.push({ source, target });
                }
            }
            for (const [key, value] of Object.entries(property)) {                  // For each key, recurse the link finding process
                processProperty(value, parentResourceName);
            }
        }
    }

    for (const [propertyName, property] of Object.entries(resource.properties)) {   // For each object, recurse the link finding process
        processProperty(property, resourceName);
    }
}

for (const sgNode of sgNodes) {                                                     // Duplicate linked SecurityGroup nodes
    const linkedNodes = links.filter(l => l.source.name === sgNode.name).map(l => l.target);
    const uniqueLinkedNodes = [...new Set(linkedNodes)];
    if (uniqueLinkedNodes.length === 0) {
        const newNode = { name: sgNode.name, type: 'SecurityGroup', data: sgNode.data };
        nodes.push(newNode);
        amounts['SecurityGroup'] = (amounts['SecurityGroup'] || 0) + 1;
    } else {
        for (const linkedNode of uniqueLinkedNodes) {                               // Link duplicate SecurityGroup nodes
            const newNode = { name: sgNode.name, type: 'SecurityGroup', data: sgNode.data };
            nodes.push(newNode);
            links.push({ source: linkedNode, target: newNode });
        }
        links.filter(l => l.source.name === sgNode.name).forEach(l => links.splice(links.indexOf(l), 1));
    }
}
return { nodes, links, amounts, title };
}
/**
 * Takes in a an object of nodes, links, and titles.
 * Generates a node map using d3 v7 and html.
 * @param {object} nodesAndLinks - The { nodes, links, and title }
 */
function drawNodes(nodesAndLinks) {

    const nodes = nodesAndLinks.nodes;                                                  // Separates the nodes from the input
    const links = nodesAndLinks.links;                                                  // Separates the links from the input
    const amounts = nodesAndLinks.amounts
    const title = nodesAndLinks.title;                                                  // Separates the title from the input

    for (var node of nodes) {
        node.info = formatObject(node.data);                                            // Adds each node's data to itself as html
        node.ip = IpFromHtml(node.info);                                                // Adds each node's IP address from the html
    }

    const width = window.innerWidth                                                     // Stores the window width
    const height = window.innerHeight                                                   // Stores the window height

    const uniqueNodeTypes = [...new Set(nodes.map(node => node.type))];                 // Recores the unique node types in an array
    const colors = ['#000000', '#c1d72e', '#9a9b9d', '#50787f', '#636467', '#dc582a',   // Defines GCC and AU colors
        '#003359 ', '#A5ACAF', '#3CB6CE', '#00AEEF', '#64A0C8', '#44D62C'];

    const legendData = uniqueNodeTypes.map((type, i) => ({                              // Assign a GCC and AU color and count to legend data
        type,
        count: amounts[type],
        color: colors[i]
    }));

    const colorScale = (function () {                                                   // Assign a GCC and AU color to each node
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
        'Other': "./assets/img/question__mark.png"
    }

    const weights = {                                                                   // Assign each node type a weight
        'Root': 10,
        'Net': 12,
        'Subnet': 16,
        'Router': 14,
        'RouterInterface': 7,
        'Server': 12,
        'Port': 8,
        'FloatingIP': 8,
        'FloatingIPAssociation': 6,
        'ResourceGroup': 10,
        'SecurityGroup': 6,
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
        const linkedNodes = getLinkedNodes(subnetNode, depth);
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
            tooltip.html(`<p><strong>${d.name} (${d.type})</strong></p>${d.info}`);
            tooltip.style('visibility', 'visible')
                .style('text-align', 'left');
        })
        .on('mousemove', (event) => {
            const tooltip = d3.select('.tooltip');
            tooltip.style('top', (event.pageY + 10) + 'px');
            tooltip.style('left', (event.pageX - (tooltip.node().getBoundingClientRect().width / 2)) + 'px');
        })
        .on('mouseleave', () => {
            svg.attr("cursor", "crosshair");
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

    function zoomed(event) {                                                        // Define the zoomed function to account for space changing
        const { transform } = event;

        subnetGroups.attr('transform', transform);
        linksGroup.attr('transform', transform);
        nodesGroup.attr('transform', transform);
        imageGroup.attr('transform', transform);
        textGroup.attr('transform', transform);
    }

    const tooltip = d3.select('body')                                               // Define the tooltips
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

    const titleMaxWidth = width / 1.25;                                             // Set limits on the title width

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
        .attr("transform", "translate(10, 10)");

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
    }

    function drag(simulation) {                                                     // Manages the drag actions, called by nodes
        let x, y, dx, dy;

        function dragstarted(event) {                                               // Manages the begining of a drag
            if (!event.active) simulation.alphaTarget(0.3).restart();
            svg.attr("cursor", "grab");

            x = event.subject.x;
            y = event.subject.y;

            event.subject.fx = x;
            event.subject.fy = y;
        }

        function dragged(event) {                                                   // Manages the middle of a drag
            svg.attr("cursor", "grabbing");

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
            svg.attr("cursor", "crosshair");

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
    /**
     * Converts an object to an HTML string representation, recursively.
     * Duplicate values for a given key are separated by commas.
     * @param {object} obj - The object to format
     * @param {string} key - The key for the current object, defaults to empty string
     * @param {number} indent - The indentation level, defaults to 0
     * @param {string} parentKey - The key of the parent object, defaults to empty string
     * @param {object} result - The object to store results, defaults to empty object
     * @returns {string} - The HTML string representation of the object
     */
    function formatObject(obj, key = '', indent = 0, parentKey = '', result = {}) {
        let html = '';
        if (Array.isArray(obj)) {                                                       // If obj is an array: 
            obj.forEach((value) => {                                                    // Iterate over its elements 
                if (value !== '' && value !== '.') {                                    // Ignore empty and dot values
                    html += formatObject(value,                                         // Call formatObject recursively on each element
                        `${key}`,
                        indent + 2,
                        parentKey,
                        result);
                }
            });
        } else if (typeof obj === 'object' && obj !== null) {                           // If obj is an object: 
            for (const [objKey, value] of Object.entries(obj)) {                        // Iterate over its key-value pairs and call formatObject recursively on each value
                const currentKey = objKey === 'get_resource' ? parentKey : objKey;      // parentKey for get_resource objects, otherwise objKey
                if (                                                                    // Ignore specific keys
                    currentKey !== 'template' &&
                    currentKey !== 'get_param' &&
                    currentKey !== 'user_data_format' &&
                    currentKey !== 'list_join' &&
                    currentKey !== 'name'
                ) {
                    html += formatObject(value,                                         // Call formatObject recursively on each currentKey entry
                        currentKey,
                        indent + 2,
                        currentKey,
                        result);
                } else if (currentKey === 'list_join') {                                // If currentKey is list_join, use parentKey
                    html += formatObject(value,                                         // Call formatObject recursively on each parentKey entry
                        parentKey,
                        indent + 2,
                        parentKey,
                        result);
                }
            }
        } else {
            if (key !== '' && key !== undefined) {
                if (result[key] === undefined) {                                        // If obj is a primitive type: 
                    result[key] = [];                                                   // Store it in the result object under the given key
                }
                result[key].push(obj);
            }
        }
        if (key === '') {                                                               // If key is empty, format the result object as an HTML string
            for (const [resultKey, values] of Object.entries(result)) {
                if (values.length > 1) {                                                // If there are multiple values for a given key: 
                    html += `<strong>${resultKey}: </strong>${values.join(', ')}<br/>`; // Display them separated by commas
                } else {                                                                // Otherwise, 
                    html += `<strong>${resultKey}: </strong>${values[0]}<br/>`;         // Display the single value
                }
            }
        }
        return html;
    }
    /**
     * Parses html and extracts IP address(es).
     * It finds: ip_address, fixed_ip, and cidr.
     * @param {object} html - The html to be parsed
     * @returns {string} - The IP address(es) in the html
     */
    function IpFromHtml(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const strongElements = doc.querySelectorAll('strong');
        let ip = '';

        strongElements.forEach((el) => {                                                // Loops through each html element.
            if (el.textContent.includes('ip_address')) {                                // Gets the ip_address html entries
                ip = el.nextSibling.textContent.trim();
            } else if (el.textContent.includes('fixed_ip')) {                           // Gets the fixed_ip html entries
                ip = el.nextSibling.textContent.trim();
            } else if (el.textContent.includes('cidr')) {                               // Gets the cidr html entries
                ip = el.nextSibling.textContent.trim();
            }
        });
        return ip;
    }
}
