function hotFunctions(parsedContent) {
    for (const [key, value] of Object.entries(parsedContent)) {
        switch (key) {
            case 'list_join:':
                if (
                    typeof value[1] === 'object' ||
                    typeof value[2] === 'object'
                ) {
                    hotFunctions(value);
                }
                if (Array.isArray(value[1])) {
                    parsedContent['name'] = value[1].join('');
                } else {
                    parsedContent['name'] = value.join('');
                }
                delete parsedContent['list_join:'];
                break;
            case 'get_param:':
                if (parsedContent.parameters.hasOwnProperty(key)) {
                    value = parsedContent.parameters[key];
                }
                break;
            default:
                if (typeof value === 'object' && value !== null) {
                    if (Array.isArray(value)) {
                        for (const element of value) {
                            hotFunctions(element);
                        }
                    } else {
                        hotFunctions(value);
                    }
                }
                break;
        }
    }
}

export {
    hotFunctions
};
