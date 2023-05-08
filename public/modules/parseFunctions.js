function createSGNode(sgNode, nodes, links, amounts) {
    const targetNodes = links.filter(l => l.source.name === sgNode.name).map(l => l.target);
    const sourceNodes = links.filter(l => l.target.name === sgNode.name).map(l => l.source);
    const uniqueLinkedNodes = [...new Set([...targetNodes, ...sourceNodes])];
    
    if (uniqueLinkedNodes.length === 0) {
        const newNode = { ...sgNode };
        nodes.push(newNode);
        amounts[sgNode.type] = (amounts[sgNode.type] || 0) + 1;
    } else {
        for (const linkedNode of uniqueLinkedNodes) {
            const newNode = { ...sgNode };
            nodes.push(newNode);
            links.push({ source: linkedNode, target: newNode });
        }
        links.filter(l => l.source.name === sgNode.name).forEach(l => links.splice(links.indexOf(l), 1));
    }
}

export {
    createSGNode
};
