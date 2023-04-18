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
    const root = { name: "openstack", type: "Root" };
    const nodes = [root];
    const links = [];
    const sgNodes = [];

    if (parsedContent.parameters.range_id) {
        var title = parsedContent.parameters.range_id.default;
    } else if (parsedContent.description) {
        var title = parsedContent.description;
    } else {
        var title = "No Title Found...";
    }

    for (const [resourceName, resource] of Object.entries(parsedContent.resources)) {
        const name = `${resourceName}`;
        const type = resource.type.split("::")[2];
        const data = resource.properties;

        const node = { name, type, data };

        if (type === 'SecurityGroup') {
            sgNodes.push(node);
        } else {
            nodes.push(node);
        }

        if (type === 'Router') {
            links.push({ source: node, target: root });
        }
    }

    for (const [resourceName, resource] of Object.entries(parsedContent.resources)) {
        const processProperty = (property, parentResourceName) => {
            if (typeof property === 'object') {
                if (property['get_resource'] !== undefined) {
                    const target = nodes.find(n => n.name === parentResourceName);
                    const sourceName = property['get_resource'];
                    const source = sgNodes.find(n => n.name === sourceName) || nodes.find(n => n.name === sourceName);
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

    // Duplicate SecurityGroup nodes and update links
    for (const sgNode of sgNodes) {
        const linkedNodes = links.filter(l => l.source.name === sgNode.name).map(l => l.target);
        const uniqueLinkedNodes = [...new Set(linkedNodes)];
        if (uniqueLinkedNodes.length === 0) {
            const newNode = { name: sgNode.name, type: 'SecurityGroup', data: sgNode.data };
            nodes.push(newNode);
        } else {
            for (const linkedNode of uniqueLinkedNodes) {
                const newNode = { name: sgNode.name, type: 'SecurityGroup', data: sgNode.data };
                nodes.push(newNode);
                links.push({ source: linkedNode, target: newNode });
            }
            links.filter(l => l.source.name === sgNode.name).forEach(l => links.splice(links.indexOf(l), 1));
        }
    }
    return { nodes, links, title };
}

function drawNodes(nodesAndLinks) {
    //  Draws a network diagram from a node map.
    //  Requires: A node map
    //  Returns: The network map the node map represents

    /**
     * Converts an object to an HTML string representation, recursively.
     * Duplicate values for a given key are separated by commas.
     * @param {object} obj - the object to format
     * @param {string} key - the key for the current object, defaults to empty string
     * @param {number} indent - the indentation level, defaults to 0
     * @param {string} parentKey - the key of the parent object, defaults to empty string
     * @param {object} result - the object to store results, defaults to empty object
     * @returns {string} - the HTML string representation of the object
     */
    function formatObject(obj, key = '', indent = 0, parentKey = '', result = {}) {
        let html = '';
        // if obj is an array, iterate over its elements and call formatObject recursively on each element
        if (Array.isArray(obj)) {
            obj.forEach((value) => {
                // ignore empty and dot values
                if (value !== '' && value !== '.') {
                    html += formatObject(value, `${key}`, indent + 2, parentKey, result);
                }
            });
            // if obj is an object, iterate over its key-value pairs and call formatObject recursively on each value
        } else if (typeof obj === 'object' && obj !== null) {
            for (const [objKey, value] of Object.entries(obj)) {
                // use parentKey as key for get_resource objects, otherwise use objKey as key
                const currentKey = objKey === 'get_resource' ? parentKey : objKey;
                // ignore specific keys
                if (
                    currentKey !== 'template' &&
                    currentKey !== 'get_param' &&
                    currentKey !== 'user_data_format' &&
                    currentKey !== 'list_join' &&
                    currentKey !== 'name'
                ) {
                    html += formatObject(value, currentKey, indent + 2, currentKey, result);
                } else if (currentKey === 'list_join') {
                    // for list_join, use parentKey as key
                    html += formatObject(value, parentKey, indent + 2, parentKey, result);
                } else if (currentKey === "ip_address") {
                    obj.ip = value
                }
            }
            // if obj is a primitive type, store it in the result object under the given key
        } else {
            if (key !== '' && key !== undefined) {
                if (result[key] === undefined) {
                    result[key] = [];
                }
                result[key].push(obj);
            }
        }
        // if key is empty, format the result object as an HTML string
        if (key === '') {
            for (const [resultKey, values] of Object.entries(result)) {
                // if there are multiple values for a given key, display them separated by commas
                if (values.length > 1) {
                    html += `<strong>${resultKey}: </strong>${values.join(', ')}<br/>`;
                    // otherwise, display the single value
                } else {
                    html += `<strong>${resultKey}: </strong>${values[0]}<br/>`;
                }
            }
        }
        return html;
    }

    function IpFromHtml(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        let ip = '';

        const strongElements = doc.querySelectorAll('strong');
        strongElements.forEach((el) => {
            if (el.textContent.includes('ip_address')) {
                ip = el.nextSibling.textContent.trim();
            } else if (el.textContent.includes('fixed_ip')) {
                ip = el.nextSibling.textContent.trim();
            } else if (el.textContent.includes('cidr')) {
                ip = el.nextSibling.textContent.trim();
            }
        });
        return ip;
    }

    const nodes = nodesAndLinks.nodes;
    const links = nodesAndLinks.links;
    const title = nodesAndLinks.title;

    for (var node of nodes) {
        node.info = formatObject(node.data);
        node.ip = IpFromHtml(node.info);
    }

    const width = window.innerWidth
    const height = window.innerHeight

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


    // https://vecta.io/symbols/241/cisco-network-topology-icons-black-and-white
    const pictures = {
        'Root': "https://symbols.getvecta.com/stencil_241/113_gatekeeper.f0eb77a73a.svg",
        'Net': "https://symbols.getvecta.com/stencil_241/292_web-cluster.2e65dd1db3.svg",
        'Subnet': "https://symbols.getvecta.com/stencil_241/78_cloud.271ac2c149.svg",
        'Router': "https://symbols.getvecta.com/stencil_241/224_router.be30fb87e7.svg",
        'RouterInterface': "https://symbols.getvecta.com/stencil_241/165_mau.f0621db6a3.svg",
        'Server': "https://symbols.getvecta.com/stencil_241/109_file-server.0889a505f2.svg",
        'Port': "https://symbols.getvecta.com/stencil_241/178_modem.90363b409e.svg",
        'FloatingIP': "https://symbols.getvecta.com/stencil_241/74_ciscoca.106568a1a9.svg",
        'FloatingIPAssociation': "https://symbols.getvecta.com/stencil_241/287_vpn-gateway.4c256282ec.svg",
        'ResourceGroup': "https://symbols.getvecta.com/stencil_241/301_workgroup-director.1c23900b49.svg",
        'SecurityGroup': "https://symbols.getvecta.com/stencil_241/151_key.713f0682bf.svg",
        'Firewall': "https://symbols.getvecta.com/stencil_241/110_firewall.e262f4364e.svg",
        'Other': "https://symbols.getvecta.com/stencil_241/265_terminal.a18d4445ed.svg"
    }

    const weights = {
        'Root': 10,
        'Net': 12,
        'Subnet': 16,
        'Router': 14,
        'RouterInterface': 7,
        'Server': 12,
        'Port': 7,
        'FloatingIP': 8,
        'FloatingIPAssociation': 5,
        'ResourceGroup': 7,
        'SecurityGroup': 5,
        'Firewall': 10,
        'Other': 8
    };

    const force = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id))
        .force("charge", d3.forceManyBody()
            .strength(d => weights[d.type] * -150 || weights.Other * -150))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("x", d3.forceX())
        .force("y", d3.forceY())
        .on("tick", update);

    const zoom = d3.zoom()
        .scaleExtent([0.25, 4])
        .on('zoom', zoomed);

    const svg = d3.select('body')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr("cursor", "crosshair")
        .call(zoom);

    const subnetGroups = svg.selectAll('.subnet-group')
        .data(nodes.filter(d => d.type === 'Subnet'))
        .join('g')
        .attr('class', 'subnet-group');

    const perimeterPaths = subnetGroups.selectAll('.perimeter-path')
        .data(d => [d]) // bind each subnet node to its own group
        .join('path')
        .attr('class', 'perimeter-path')
        .attr('fill', d => colorScale(d.type))
        .attr('fill-opacity', 0.2)

    function drawPerimeter(subnetNode, depth = 3, paddingAngle = 20) {
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

    const linksGroup = svg.append('g')
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('stroke-width', 2)
        .attr('stroke', d => colorScale(d.source.type))
        .attr("stroke-opacity", 0.75);

    const nodesGroup = svg.append('g')
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

    const imageGroup = svg.append('g')
        .selectAll('image')
        .data(nodes)
        .join('image')
        .attr('xlink:href', d => pictures[d.type] || pictures.Other)
        .attr('width', d => weights[d.type] * 4 || weights.Other * 4)
        .attr('height', d => weights[d.type] * 4 || weights.Other * 4)
        .attr('x', d => d.x - weights[d.type] * 2 || d.x - weights.Other * 2)
        .attr('y', d => d.y - weights[d.type] * 2 || d.y - weights.Other * 2)
        .style('pointer-events', 'none');

    const textGroup = svg.append('g')
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

    function zoomed(event) {
        const { transform } = event;

        subnetGroups.attr('transform', transform);
        linksGroup.attr('transform', transform);
        nodesGroup.attr('transform', transform);
        imageGroup.attr('transform', transform);
        textGroup.attr('transform', transform);
    }

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

    const titleMaxWidth = width / 1.25;

    const top = svg.append('text')
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
        .attr("fill", d => d.color);

    legend.selectAll("text")
        .data(legendData)
        .enter()
        .append("text")
        .attr("x", 40)
        .attr("y", (d, i) => i * 30 + 15)
        .text(d => d.type)
        .style("font-size", "16px")
        .style("fill", "#333");

    var was_locked = false;
    function toggleLock() {
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

    function update() {
        nodesGroup.attr('cx', d => d.x)
            .attr('cy', d => d.y);

        imageGroup.attr('x', d => d.x - weights[d.type] * 2 || d.x - weights.Other * 2)
            .attr('y', d => d.y - weights[d.type] * 2 || d.y - weights.Other * 2);

        textGroup.attr('x', d => d.x)
            .attr('y', d => d.y)
            .text(d => {
                if (ips) {
                    return d.ip;
                } else {
                    return d.name;
                }
            });

        linksGroup.attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        if (was_locked !== locked) {
            toggleLock();
            was_locked = locked;
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
    }

    function drag(simulation) {
        let x, y, dx, dy;

        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            svg.attr("cursor", "grab");

            x = event.subject.x;
            y = event.subject.y;

            event.subject.fx = x;
            event.subject.fy = y;
        }

        function dragged(event) {
            svg.attr("cursor", "grabbing");

            const transform = d3.zoomTransform(svg.node());

            dx = transform.invertX(event.x) - transform.invertX(x);
            dy = transform.invertY(event.y) - transform.invertY(y);

            event.subject.fx = x + dx;
            event.subject.fy = y + dy;

            const tooltip = d3.select(".tooltip");
            tooltip.style("visibility", "hidden");
        }

        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            svg.attr("cursor", "crosshair");

            if (!locked) {
                event.subject.fx = null;
                event.subject.fy = null;
            }
        }

        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }
}
