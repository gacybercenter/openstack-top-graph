function createDuplicateNodes(duplicateNode, nodes, links, amounts) {
    const targetNodes = links.filter(l => l.source.name === duplicateNode.name).map(l => l.target);
    const sourceNodes = links.filter(l => l.target.name === duplicateNode.name).map(l => l.source);

    const uniqueSourceNodes = Array.from(new Set(sourceNodes));
    const uniqueTargetNodes = Array.from(new Set(targetNodes));

    uniqueSourceNodes.forEach(linkedNode => {
        const newNode = { ...duplicateNode };
        nodes.push(newNode);
        links.push({ source: linkedNode, target: newNode });
    });

    uniqueTargetNodes.forEach(linkedNode => {
        const newNode = { ...duplicateNode };
        nodes.push(newNode);
        links.push({ source: linkedNode, target: newNode });
    });

    const duplicateLinks = links.filter(l => l.source.name === duplicateNode.name);
    duplicateLinks.forEach(l => {
        links.splice(links.indexOf(l), 1);
    });

    if (uniqueSourceNodes.length === 1) {
        const sourceType = uniqueSourceNodes[0].type;
        amounts[sourceType] = (amounts[sourceType] || 0) + 1;
    }
}

export {
    createDuplicateNodes
};
