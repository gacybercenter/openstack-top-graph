// Define a function to handle file selection.
function handleFileSelect(event) {
    // Get the selected file.
    const file = event.target.files[0];

    // Check if the file is in YAML or JSON format.
    const isYaml = file.name.endsWith(".yaml") || file.name.endsWith(".yml");
    const fileType = isYaml ? "yaml" : "json";

    // Create a new FileReader object to read the contents of the file.
    const reader = new FileReader();

    // Set up a callback function to handle the file load event.
    reader.onload = function (event) {
        try {
            // Get the file contents from the FileReader object.
            const fileContent = event.target.result;

            // Parse the file contents based on the file type.
            const parsedContent = fileType === "yaml" ? jsyaml.load(fileContent) : JSON.parse(fileContent);

            // Construct a node map based on the parsed content.
            nodesAndLinks = nodeMap(parsedContent);

            // Draw the node map.
            drawNodes(nodesAndLinks);

            // Log the parsed content to the console for debugging purposes.
            console.log(parsedContent);
        } catch (error) {
            // If there was an error parsing the file, log the error to the console.
            console.error(`Error parsing ${fileType} file: ${error}`);
        }
    };

    // Read the file as text using UTF-8 encoding.
    reader.readAsText(file, "UTF-8");
}
const fileInput = document.getElementById("file-input");
fileInput.addEventListener("change", handleFileSelect, false);


function nodeMap(parsedContent) {
    //  Separate the parsed JSON or YAML heat templates into a node map.
    //  Requires: JSON or YAML
    //  Returns: A node map of the devices

    var root = { name: "openstack" };
    var nodes = [root];
    var depends = [];
    const links = []; // Create an empty array to store links between nodes.

    const resources = parsedContent.resources; // Get the resources object from the parsed content.
    for (const [resourceName, resource] of Object.entries(resources)) { // Iterate through each resource.

        const dependencies = Object.keys(resource.properties || {}); // Get the dependencies of the resource.

        const name = `${resourceName}`; // Extract the resource name.
        const type = resource.type.split("::")[2]; // Extract the resource type.

        var node = {
            'name': name,
            'type': type
        }
        nodes.push(node); // Add the node to the node map object.

        // Iterate through each dependency.
        for (const dependency of dependencies) {
            if (resource.properties[dependency] && resource.properties[dependency]["get_resource"]) {
                // Add source and target names if there is a dependency.
                sourceNode = resource.properties[dependency]["get_resource"];
                depends.push({
                    source: sourceNode,
                    target: resourceName
                });
            }
        }
    }
    // Iterate through each dependency.
    for (const depend of depends) {
        links.push({
            source: nodes[findIndex(nodes, depend['source'])],
            target: nodes[findIndex(nodes, depend['target'])]
        });
    }
    return { "nodes": nodes, "links": links }; // Return the node map and links as an object.
}

function drawNodes(nodesAndLinks) {
    //  Draws a network diagram from a node map.
    //  Requires: A node map
    //  Returns: The network map the node map represents

    // Extract the node map and links from the input object
    const nodes = nodesAndLinks["nodes"];
    const links = nodesAndLinks["links"];
    
    let WIDTH = window.innerWidth;
    let HEIGHT = window.innerHeight;
    
    const svg = d3.select("svg")
        .attr("width", WIDTH)
        .attr("height", HEIGHT);
    
    let link = svg.selectAll(".link");
    let node = svg.selectAll(".node");
    
    const simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id))
        .force("charge", d3.forceManyBody())
        .force("center", d3.forceCenter(WIDTH / 2, HEIGHT / 2))
        .force("collision", d3.forceCollide().radius(d => d.r * 1.1))
        .on("tick", () => {
            // Add boundary checking
            node.attr("transform", d => `translate(${Math.max(d.r, Math.min(WIDTH - d.r, d.x))},${Math.max(d.r, Math.min(HEIGHT - d.r, d.y))})`);
            link.attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);
            node.attr("transform", d => `translate(${d.x},${d.y})`);
        });
    
    const drag = simulation => {
        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }
        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
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
    
    link = link.data(links)
        .enter().append("line")
        .attr("class", "link");
    
    node = node.data(nodes)
        .enter().append("g")
        .attr("class", "node")
        .call(drag(simulation));
    
    node.append("foreignObject")
        .attr("width", "20")
        .attr("height", "20")
        .html(d => {
            switch (d.type) {
                case "Net":
                    return '<i class="fas fa-cloud"></i>';
                case "Subnet":
                    return '<i class="fas fa-network-wired"></i>';
                case "Server":
                    return '<i class="fas fa-desktop"></i>';
                case "ResourceGroup":
                    return '<i class="fas fa-server"></i>';
                case "Port":
                    return '<i class="fas fa-ethernet"></i>';
                case "Router":
                    return '<i class="fas fa-border-all"></i>';
                case "RouterInterface":
                    return '<i class="fas fa-sort-down"></i>';
                default:
                    return '<i class="fas fa-question"></i>';
            }
        });
    
    node.append("text")
        .text(d => d.id);
    
    simulation.alpha(1).restart();
}


function findIndex(arr, targetName) {
    try {
        for (let i in arr) {
            if (arr[i].hasOwnProperty('name') && arr[i]['name'] === targetName) {
                return i;
            }
        }
    }
    catch (error) {
        // If there was an finding the dependency index, log the error to the console.
        console.error(`Error parsing ${fileType} file: ${error}`);
    }
    return -1; // If the target name is not found in any dictionary, return -1.
}