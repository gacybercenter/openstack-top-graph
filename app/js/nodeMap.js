import {
    replaceIndex,
    mergeContents
} from "./parseFunctions.js";

import {
    createDuplicateNodes
} from "./utilityFunctions.js";

/**
 * Parses through the data extracting information like: nodes, links, and the title.
 * It also duplicates attached security groups and adds a root node.
 * @param {object} parsedContent - The parsed JAML or JSON
 * @returns {object} - The { nodes, links, amounts, title, and parameters }
 */
function nodeMap(parsedContent) {
    const root = { name: "cloud", type: "Root" };                                       // Initialize the data structures.
    const amounts = { Root: 1 };
    const resources = {
        vcpus: 0,
        ram: 0,
        disk: 0
    };
    const flavors = {
        "d1.nano": {
            "vcpus": 1,
            "ram": 1,
            "disk": 16
        },
        "d1.small": {
            "vcpus": 1,
            "ram": 2,
            "disk": 32
        },
        "d1.medium": {
            "vcpus": 2,
            "ram": 4,
            "disk": 64
        },
        "d1.large": {
            "vcpus": 2,
            "ram": 8,
            "disk": 128
        },
        "d1.xlarge": {
            "vcpus": 4,
            "ram": 16,
            "disk": 256
        },
        "d1.xlarge.cpu": {
            "vcpus": 16,
            "ram": 16,
            "disk": 256
        },
        "so.sensor": {
            "vcpus": 4,
            "ram": 12,
            "disk": 150
        },
        "r1.nano": {
            "vcpus": 1,
            "ram": 2,
            "disk": 8
        },
        "r1.small": {
            "vcpus": 2,
            "ram": 4,
            "disk": 16
        },
        "r1.medium": {
            "vcpus": 2,
            "ram": 8,
            "disk": 32
        },
        "r1.large": {
            "vcpus": 2,
            "ram": 16,
            "disk": 64
        },
        "r1.xlarge": {
            "vcpus": 8,
            "ram": 32,
            "disk": 128
        },
        "c1.nano": {
            "vcpus": 2,
            "ram": 1,
            "disk": 8
        },
        "c1.small": {
            "vcpus": 4,
            "ram": 2,
            "disk": 16
        },
        "c1.medium": {
            "vcpus": 8,
            "ram": 4,
            "disk": 32
        },
        "c1.large": {
            "vcpus": 16,
            "ram": 8,
            "disk": 64
        },
        "c1.xlarge": {
            "vcpus": 32,
            "ram": 16,
            "disk": 128
        },
        "m1.nano": {
            "vcpus": 1,
            "ram": 2,
            "disk": 16
        },
        "m1.small": {
            "vcpus": 2,
            "ram": 4,
            "disk": 32
        },
        "m1.medium": {
            "vcpus": 4,
            "ram": 8,
            "disk": 64
        },
        "m1.large": {
            "vcpus": 6,
            "ram": 12,
            "disk": 64
        },
        "m1.xlarge": {
            "vcpus": 8,
            "ram": 16,
            "disk": 128
        }
    }
    let nodes = [root];
    let links = [];
    let duplicateNodes = [];

    /**
     * Creates a node object based on the given resource and resource name,
     * and adds it to the appropriate list of nodes. The function also handles
     * special cases for certain node types and adds links if the node is a Router.
     * @param {string} name - The name of the resource to be created.
     * @param {object} resource - The resource object containing data for the new node.
     * @param {number} [count=0] - The number of nodes to create if the resource is a ResourceGroup.
     */
    function createNode(name, resource, count = 0) {
        const type = resource.type.split('::')[2] || resource.type;
        const data = resource.properties;
        const node = { name, type, data };
        amounts[type] = (amounts[type] || 0) + 1;
        switch (type) {
            case 'Server':
                if (flavors.hasOwnProperty(data.flavor)) {
                    var vcpus = flavors[data.flavor].vcpus;
                    var ram = flavors[data.flavor].ram;
                    var disk = flavors[data.flavor].disk;
                    var resourcesText = `vCPUs: ${vcpus} | RAM: ${ram} GB | Disk: ${disk} GB`;

                    data.flavor = `${data.flavor} (${resourcesText})`;

                    resources.vcpus += vcpus;
                    resources.ram += ram;
                    resources.disk += disk;
                } else {
                    data.flavor = `${data.flavor} (Unknown)`;
                    alert(`Unknown flavor: ${data.flavor}`);
                    console.log(`Unknown flavor: ${data.flavor}`);
                }
                nodes.push(node);
                break;
            case 'SecurityGroup':
            case 'SoftwareConfig':
            case 'RandomString':
                duplicateNodes.push(node);
                break;
            case 'ResourceGroup':
                for (const [key, value] of Object.entries(data)) {
                    if (key === 'count') {
                        count = value;
                        break;
                    }
                }
                for (const [key, value] of Object.entries(data)) {
                    if (key === 'resource_def') {
                        for (let index = 1; index <= count; index++) {
                            let newProp = replaceIndex(value, index);
                            let newName = newProp.properties.name;
                            if (newName === value.properties.name) {
                                newName = `${value.properties.name} (${index})`;
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
     * Traverses an object or array and performs an action on each property based on a condition.
     *
     * @param {object | array} object - The object or array to traverse.
     * @param {function} action - The action to perform on each property.
     * @param {string} parentResourceName - The name of the parent resource to pass to the action.
     */
    function traverseObject(object, action, parentResourceName) {
        if (!object) return;
        if (Array.isArray(object)) {
            for (const element of object) {
                traverseObject(element, action, parentResourceName);
            }
        } else if (typeof object === 'object') {
            action(object, parentResourceName);

            for (const value of Object.values(object)) {
                traverseObject(value, action, parentResourceName);
            }
        }
    }

    /**
     * Links a resource to its parent resource based on a property name.
     *
     * @param {object | array} property - The property to search for.
     * @param {string} parentResourceName - The name of the parent resource to link.
     * @returns {Array} - The list of connected nodes.
     */
    function mergeNode(property, parentResourceName, nodes, amounts) {
        const portLinks = [];

        const action = (property, parentResourceName) => {
            const isResource = property.get_resource !== undefined;
            const isPort = property.port !== undefined;

            if (isResource || isPort) {
                let target = nodes.find(n => n.name === parentResourceName);
                let sourceName = property.get_resource || property.port;
                let source = nodes.find(n => n.name === sourceName) ||
                    duplicateNodes.find(n => n.name === sourceName);

                if (source && target && mergeNodeTypes[source.type]) {
                    let currentType = mergeNodeTypes[source.type];
                    let newType = `${currentType}_${source.type}`;
                    if (currentType === target.type) {
                        amounts[newType] = (amounts[newType] || 0) + 1;
                        amounts[source.type] -= 1;
                        amounts[currentType] -= 1;
                        target.type = newType;
                        portLinks.push({ source, target });
                    } else if (newType === target.type) {
                        amounts[source.type] -= 1;
                        portLinks.push({ source, target });
                    }
                }
            }
        };

        traverseObject(property, action, parentResourceName);

        return portLinks;
    }


    /**
     * Links a resource to its parent resource based on a property name.
     *
     * @param {object | array} property - The property to search for.
     * @param {string} parentResourceName - The name of the parent resource to link.
     */
    function getResource(property, parentResourceName, nodes) {
        const action = (property, parentResourceName) => {
            const isResource = property.get_resource !== undefined;
            const isPort = property.port !== undefined;

            if (isResource || isPort) {
                let target = nodes.find(n => n.name === parentResourceName);
                let sourceName = property.get_resource || property.port;
                let source = nodes.find(n => n.name === sourceName) ||
                    duplicateNodes.find(n => n.name === sourceName);

                if (source && target) {
                    if (target.type === 'RouterInterface' && source.type === 'Subnet') {
                        target.data['fixed_ip'] = source.data['gateway_ip'];
                    }
                    if (mergeNodes && mergeNodeTypes[source.type]) {
                        let newSource = portLinks.find(link => link.source === source);
                        if (newSource && newSource.target) {
                            source = newSource.target
                        }
                    }
                    if (source.type !== 'Net' || !mergeNodeTypes[target.type]) {
                        links.push({ source, target });
                    }
                }
            }
        };

        traverseObject(property, action, parentResourceName);
    }

    for (const [resourceName, resource] of Object.entries(parsedContent.resources)) {
        if (resource) createNode(resourceName, resource);
    }

    const mergeNodeTypes = {
        Port: 'Server',
        Server_Port: 'Server_Port'
    }

    // const mergeNodeTypes = {Port: 'Server',
    //                         FloatingIPAssociation: 'FloatingIP',
    //                         RouterInterface: 'Router',
    //                         SoftwareConfig: 'MultipartMime',
    //                         Server_Port: 'Server_Port',
    //                         FloatingIP_FloatingIPAssociation: 'FloatingIP_FloatingIPAssociation',
    //                         Router_RouterInterface: 'Router_RouterInterface',
    //                         MultipartMime_SoftwareConfig: 'MultipartMime_SoftwareConfig'};
    const portLinks = [];

    if (mergeNodes) {
        for (const node of nodes) {
            if (node.data) portLinks.push(...mergeNode(node.data, node.name, nodes, amounts));
        }
        for (const portLink of portLinks) {
            mergeContents(portLink.target, portLink.source);
        }
    }

    for (const node of nodes) {
        if (node.data) getResource(node.data, node.name, nodes, amounts);
    }

    nodes = nodes.filter(node => !portLinks.some(link => link.source === node));
    links = links.filter(link => nodes.includes(link.source && link.target));

    duplicateNodes.forEach(duplicateNode => {
        createDuplicateNodes(duplicateNode, nodes, links, amounts);
    });

    for (const node of nodes) {
        let sourceNumber = links.filter(link => link.source === node).length;
        let targetNumber = links.filter(link => link.target === node).length;

        node.weight = (50 + sourceNumber * 25 + targetNumber * 10) ** 0.5;
    }

    return { nodes, links, amounts, resources, parameters: parsedContent.parameters };
}

export { nodeMap };
