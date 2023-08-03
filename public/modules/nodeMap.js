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
    const links = [];
    const duplicateNodes = [];

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
 * Merges the port of a property with the data of the parent resource.
 *
 * @param {object} property - The property object to merge.
 * @param {string} parentResourceName - The name of the parent resource.
 * @param {array} convertedNodes - An array of converted nodes.
 * @param {object} amounts - An object containing the amounts of different types.
 */
function mergePort(property, parentResourceName, convertedNodes, amounts) {
    const action = (property, parentResourceName) => {
        const isResource = property.get_resource !== undefined;
        const isPort = property.port !== undefined;

        if (isResource || isPort) {
            let target = nodes.find(n => n.name === parentResourceName);
            let sourceName = property.get_resource || property.port;
            let source = nodes.find(n => n.name === sourceName) ||
                duplicateNodes.find(n => n.name === sourceName);

            if (source && target && (source.type === 'Port' || source.type === 'ServerPort')) {
                if (target.type === 'Server') {
                    const sourceData = source.data;
                    mergeContents(target.data, sourceData, true);

                    target.type = 'ServerPort';
                    target.name = source.name;
                    amounts['ServerPort'] = (amounts['ServerPort'] || 0) + 1;
                    amounts['Server'] -= 1;
                } else if (target.type === 'ServerPort') {
                    mergeContents(target.data, source.data, true);
                    if (!target.name.includes(source.name)) {
                        target.name += `, ${source.name}`;
                    }
                }
            }
        }
    };

    traverseObject(property, action, parentResourceName);
}

/**
 * Merges the port of a property with the data of the parent resource.
 *
 * @param {object} property - The property object to merge.
 * @param {string} parentResourceName - The name of the parent resource.
 * @param {object} amounts - An object containing the amounts of different types.
 */
function mergePort(property, parentResourceName, amounts) {
    const action = (property, parentResourceName) => {
        const isResource = property.get_resource !== undefined;
        const isPort = property.port !== undefined;

        if (isResource || isPort) {
            let target = nodes.find(n => n.name === parentResourceName);
            let sourceName = property.get_resource || property.port;
            let source = nodes.find(n => n.name === sourceName) ||
                duplicateNodes.find(n => n.name === sourceName);

            if (source && target && (source.type === 'Port' || source.type === 'ServerPort')) {
                if (target.type === 'Server') {
                    mergeContents(source.data, target.data, true);

                    target.type = 'ServerPort';
                    target.name = source.name;
                    amounts['ServerPort'] = (amounts['ServerPort'] || 0) + 1;
                    amounts['Server'] -= 1;
                } else if (target.type === 'ServerPort') {
                    mergeContents(target.data, source.data, true);
                    if (!target.name.includes(source.name)) {
                        target.name = target.name.concat(`, ${source.name}`);
                    }
                }
            }
        }
    };

    traverseObject(property, action, parentResourceName);
}


    /**
     * Links a resource to its parent resource based on a property name.
     *
     * @param {object | array} property - The property to search for.
     * @param {string} parentResourceName - The name of the parent resource to link.
     */
    function getResource(property, parentResourceName) {
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

    if (mergePorts) {
        for (const node of nodes) {
            if (node.data) {
                mergePort(node.data, node.name, amounts);
            }
        }
        nodes = nodes.filter(n => n.type !== 'Port');
    }

    for (const node of nodes) {
        if (node.data) {
            getResource(node.data, node.name);
        }
    }

    console.log(links);

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
