function createDuplicateNodes(duplicateNode, nodes, links, amounts) {
    
    const targetNodes = links.filter(l => l.source.name === duplicateNode.name)             // Get the duplicate target nodes
        .map(l => l.target);
    const sourceNodes = links.filter(l => l.target.name === duplicateNode.name)             // Get the duplicate source nodes
        .map(l => l.source);

    const uniqueSourceNodes = [...new Set([...sourceNodes])];                               // Get the unique source and target nodes
    const uniqueTargetNodes = [...new Set([...targetNodes])];                               // Get the unique source and target nodes

    if (uniqueSourceNodes) {
        if (uniqueSourceNodes.length > 0) {                                                 // If there is only one duplicate add it normally
            for (const linkedNode of uniqueSourceNodes) {
                const newNode = { ...duplicateNode };
                nodes.push(newNode);
                links.push({ source: linkedNode, target: newNode });
            }
            links.filter(l => l.source.name === duplicateNode.name)                         // Push the duplicate links
                .forEach(l => links.splice(links.indexOf(l), 1));
        } else if (uniqueSourceNodes[0]) {                                                  // If there is only one duplicate add it normally
            const newNode = { ...sourceNodes };
            nodes.push(newNode);
            amounts[sourceNodes.type] = (amounts[sourceNodes.type] || 0) + 1;
        }
    }
    if (uniqueTargetNodes) {
        if (uniqueTargetNodes.length > 0) {                                                 // If there are multiple duplicates add them uniquely
            for (const linkedNode of uniqueTargetNodes) {
                const newNode = { ...duplicateNode };
                nodes.push(newNode);
                links.push({ source: linkedNode, target: newNode });
            }
            links.filter(l => l.source.name === duplicateNode.name)                          // Push the duplicate links
                .forEach(l => links.splice(links.indexOf(l), 1));
        } else if (uniqueTargetNodes[0]) {                                                   // If there is only one duplicate add it normally
            const newNode = { ...targetNodes };
            nodes.push(newNode);
            amounts[targetNodes.type] = (amounts[targetNodes.type] || 0) + 1;
        }
    }
}

export {
    createDuplicateNodes
};
