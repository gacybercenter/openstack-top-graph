function replaceIndex(object, index) {
    if (typeof object === 'string') {
        return object.replace('%index%', index);
    } else if (Array.isArray(object)) {
        return object.map(item => replaceIndex(item, index));
    } else if (typeof object === 'object' && object !== null) {
        const newObj = {};
        for (const [key, value] of Object.entries(object)) {
            newObj[key] = replaceIndex(value, index);
        }
        return newObj;
    } else {
        return object;
    }
}

export {
    replaceIndex
};
