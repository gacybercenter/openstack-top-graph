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
    const nodeMap = {}; // Create an empty object to store nodes.
    const links = []; // Create an empty array to store links between nodes.

    const resources = parsedContent.resources; // Get the resources object from the parsed content.
    for (const [resourceName, resource] of Object.entries(resources)) { // Iterate through each resource.
        const type = resource.type.split("::")[2]; // Extract the resource type.
        const id = `${resourceName}`; // Extract the resource ID.
        nodeMap[resourceName] = { id, type }; // Add the node to the node map object.
    }
    console.log(nodeMap); // Print the node map object to the console.

    for (const [resourceName, resource] of Object.entries(resources)) { // Iterate through each resource.
        const dependencies = Object.keys(resource.properties || {}); // Get the dependencies of the resource.
        for (const dependency of dependencies) { // Iterate through each dependency.
            if (resource.properties[dependency] && resource.properties[dependency]["get_resource"]) {
                const dependentResourceName = resource.properties[dependency]["get_resource"];
                const sourceId = nodeMap[dependentResourceName].id;
                const targetId = nodeMap[resourceName].id;
                links.push({ source: sourceId, target: targetId }); // Add a link between the dependent and target resources.
            }
        }
        if (resource.properties && resource.properties.fixed_ips) {
            for (const fixedIp of resource.properties.fixed_ips) {
                if (fixedIp.subnet) {
                    const sourceId = nodeMap[resourceName].id;
                    const targetId = nodeMap[fixedIp.subnet]["id"];
                    links.push({ source: sourceId, target: targetId }); // Add a link between the resource and the subnet.
                }
            }
        }
        switch (resource.type) { // Check the resource type and set the type of the node accordingly.
            case "OS::Neutron::Net":
                nodeMap[resourceName].type = "Net";
                break;
            case "OS::Neutron::Subnet":
                nodeMap[resourceName].type = "Subnet";
                break;
            case "OS::Nova::Server":
                nodeMap[resourceName].type = "Server";
                break;
            case "OS::Heat::ResourceGroup":
                nodeMap[resourceName].type = "ResourceGroup";
                break;
            case "OS::Neutron::Port":
                nodeMap[resourceName].type = "Port";
                break;
            case "OS::Neutron::Router":
                nodeMap[resourceName].type = "Router";
                break;
            case "OS::Neutron::RouterInterface":
                nodeMap[resourceName].type = "RouterInterface";
                break;
            default:
                nodeMap[resourceName].type = "Unknown";
                break;
        }
    }
    return {"nodeMap" : nodeMap, "links" : links}; // Return the node map and links as an object.
}


function drawNodes(nodesAndLinks) {
    //  Draws a network diagram from a node map.
    //  Requires: A node map
    //  Returns: The network map the node map represents
    
    // Extract the node map and links from the input object
    const nodeMap = nodesAndLinks["nodeMap"];
    const links = nodesAndLinks["links"];

    // Set the dimensions of the SVG element
    WIDTH = innerWidth;
    HEIGHT = innerHeight;    

    // Select the SVG element and set its width and height attributes
    const svg = d3.select("svg")
    .attr("width", WIDTH)
    .attr("height", HEIGHT);

    // Set up the simulation
    const simulation = d3.forceSimulation()
        .force("link", d3.forceLink(links).id(d => d.id))
        .force("charge", d3.forceManyBody())
        .force("center", d3.forceCenter(WIDTH / 2, HEIGHT / 2))
        .force("collision", d3.forceCollide().radius(d => d.r * 1.1))
        .on("tick", () => {
            // Update the positions of the nodes and links
            node.attr("transform", d => `translate(${Math.max(d.r, Math.min(WIDTH - d.r, d.x))},${Math.max(d.r, Math.min(HEIGHT - d.r, d.y))})`);
            link.attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);
            node.attr("transform", d => `translate(${d.x},${d.y})`);
        });

    // Create selections for the links and nodes
    let link = svg.selectAll(".link");
    let node = svg.selectAll(".node");
    
    // Define the drag behavior for the nodes
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

    // Extract the nodes from the node map
    const nodes = Object.values(nodeMap);

    // Bind the data to the links and nodes selections and create new elements as needed
    link = link.data(links)
    link = link.data(links)
        .enter().append("line")
        .attr("class", "link");
    node = node.data(nodes)
        .enter().append("g")
        .attr("class", "node")
        .call(drag(simulation));

    // Add the icons to the nodes based on their type
    node.append("foreignObject")
        .attr("width", "20")
        .attr("height", "20")
        .html(d => {
            switch (d.type) {
                case "Net":
                    return '<i class="fas fa-cloud"></i>'; // Cloud icon
                case "Subnet":
                    return '<i class="fas fa-network-wired"></i>'; // Network icon
                case "Server":
                    return '<i class="fas fa-desktop"></i>'; // Desktop icon
                case "ResourceGroup":
                    return '<i class="fas fa-server"></i>'; // Server icon
                case "Port":
                    return '<i class="fas fa-ethernet"></i>'; // Ethernet icon
                case "Router":
                    return '<i class="fas fa-border-all"></i>'; // Router icon
                case "RouterInterface":
                    return '<i class="fas fa-sort-down"></i>'; // Arrow down icon
                default:
                    return '<i class="fas fa-question"></i>'; // Question mark icon
            }
        });
    node.append("text")
        .text(d => d.id);
    simulation.nodes(nodes);
    simulation.force("link").links(links);
    simulation.alpha(1).restart();
}