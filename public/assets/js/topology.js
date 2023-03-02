
WIDTH = innerWidth;
HEIGHT = innerHeight;

const svg = d3.select("svg")
    .attr("width", WIDTH)
    .attr("height", HEIGHT);
const nodeMap = {};
const links = [];
const simulation = d3.forceSimulation()
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
let link = svg.selectAll(".link");
let node = svg.selectAll(".node");
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
const fileInput = document.getElementById("file-input");
fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!(file instanceof Blob)) {
        console.error("Selected file is not a Blob object");
        return;
    }
    const reader = new FileReader();
    reader.onload = () => {
        const hotTemplateYaml = reader.result;
        const hotTemplate = jsyaml.load(hotTemplateYaml);
        const resources = hotTemplate.resources;
        for (const [resourceName, resource] of Object.entries(resources)) {
            const type = resource.type.split("::")[2];
            const id = `${resourceName}`;
            nodeMap[resourceName] = { id, type };
        }
        console.log(nodeMap);

        for (const [resourceName, resource] of Object.entries(resources)) {
            const dependencies = Object.keys(resource.properties || {});
            for (const dependency of dependencies) {
                if (resource.properties[dependency] && resource.properties[dependency]["get_resource"]) {
                    const dependentResourceName = resource.properties[dependency]["get_resource"];
                    const sourceId = nodeMap[dependentResourceName].id;
                    const targetId = nodeMap[resourceName].id;
                    links.push({ source: sourceId, target: targetId });
                }
            }
            if (resource.properties && resource.properties.fixed_ips) {
                for (const fixedIp of resource.properties.fixed_ips) {
                    if (fixedIp.subnet) {
                        const sourceId = nodeMap[resourceName].id;
                        const targetId = nodeMap[fixedIp.subnet]["id"];
                        links.push({ source: sourceId, target: targetId });
                    }
                }
            }
            switch (resource.type) {
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

        const nodes = Object.values(nodeMap);

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
        simulation.nodes(nodes);
        simulation.force("link").links(links);
        simulation.alpha(1).restart();
    };
    reader.readAsText(file);
});
