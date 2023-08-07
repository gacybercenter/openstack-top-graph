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
    function getPortLinks(property, parentResourceName, nodes, amounts) {
        const portLinks = [];

        const action = (property, parentResourceName) => {
            const isResource = property.get_resource !== undefined;
            const isPort = property.port !== undefined;

            if (isResource || isPort) {
                let target = nodes.find(n => n.name === parentResourceName);
                let sourceName = property.get_resource || property.port;
                let source = nodes.find(n => n.name === sourceName) ||
                    duplicateNodes.find(n => n.name === sourceName);

                if (source && target && source.type === 'Port') {
                    if (target.type === 'Server') {
                        amounts['ServerPort'] = (amounts['ServerPort'] || 0) + 1;
                        amounts['Server'] -= 1;
                        amounts['Port'] -= 1;
                        target.type = 'ServerPort';
                        portLinks.push({ source, target });
                    } else if (target.type === 'ServerPort') {
                        amounts['Port'] -= 1;
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
                    if (mergePorts && source.type === 'Port') {
                        let newSource = portLinks.find(link => link.source === source);
                        if (newSource && newSource.target) {
                            source = newSource.target
                        }
                    }
                    if (target.type === 'RouterInterface' && source.type === 'Subnet') {
                        target.data['fixed_ip'] = source.data['gateway_ip'];
                    }
                    if (source.type !== 'Net' || (target.type !== 'Port' && target.type !== 'ServerPort')) {
                        links.push({ source, target });
                    }
                }
            }
        };

        traverseObject(property, action, parentResourceName);
    }


    for (const [resourceName, resource] of Object.entries(parsedContent.resources)) {
        if (resource !== undefined) {
            createNode(resourceName, resource);
        }
    }

    const portLinks = [];

    if (mergePorts) {
        for (const node of nodes) {
            if (node.data) {
                portLinks.push(...getPortLinks(node.data, node.name, nodes, amounts));
            }
        }
        for (const portLink of portLinks) {
            mergeContents(portLink.target, portLink.source);
        }
    } 

    for (const node of nodes) {
        if (node.data) {
            getResource(node.data, node.name, nodes, amounts);
        }
    }

    nodes = nodes.filter(node => !portLinks.some(link => link.source === node));
    links = links.filter(link => nodes.includes(link.source && link.target));

    duplicateNodes.forEach(duplicateNode => {
        createDuplicateNodes(duplicateNode, nodes, links, amounts);
    });

    for (const node of nodes) {
        node.weight = 50;
        links.forEach(link => {
            if (node.data === link.source.data) {
                node.weight += 25;
            }
            if (node.data === link.target.data) {
                node.weight += 10;
            }
        });
        node.weight **= 0.5;
    }

    return { nodes, links, amounts, parameters: parsedContent.parameters };
}

export { nodeMap };
