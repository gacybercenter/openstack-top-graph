import {
    replaceIndex
} from "./parseFunctions.js";

import {
    createDuplicateNodes
} from "./utilityFunctions.js";

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
     * Links a resource to its parent resource based on a property name.
     *
     * @param {object | array} property - The property to search for.
     * @param {string} parentResourceName - The name of the parent resource to link.
     */
    function getResource(property, parentResourceName) {
        if (typeof property !== 'object') {
            if (Array.isArray(property)) {
                for (const element of property) {
                    getResource(element, parentResourceName);
                }
            }
            return;
        }

        const isNode = property.get_resource !== undefined || property.port !== undefined;
        if (isNode) {
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

    duplicateNodes.forEach(duplicateNode => {
        createDuplicateNodes(duplicateNode, nodes, links, amounts);
    });

    return { nodes, links, amounts, title, parameters: parsedContent.parameters };
}

export { nodeMap };
