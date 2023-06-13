function getParam(parsedContent, resources = parsedContent.resources, parameters = parsedContent.parameters) {
    for (const [key, value] of Object.entries(resources)) {
        if (isGetParam(value)) {
            const parameterName = value.get_param;
            if (parameters[parameterName] !== undefined) {
                resources[key] = parameters[parameterName].default;
            }
        } else if (isObject(value)) {
            getParam(parsedContent, value, parameters);
        } else if (isArray(value)) {
            value.forEach(item => getParam(parsedContent, item, parameters));
        }
    }
    return parsedContent;
}

function strReplace(parsedContent, resources = parsedContent.resources) {
    for (const [key, value] of Object.entries(resources)) {
        if (isStrReplaceable(value)) {
            const template = value.str_replace.template;
            const params = value.str_replace.params;
            const replacedTemplate = replaceParams(template, params);
            resources[key] = replacedTemplate;
            resources['params'] = params;
        } else if (isObject(value)) {
            strReplace(parsedContent, value);
        } else if (isArray(value)) {
            value.forEach(item => strReplace(parsedContent, item));
        }
    }
    return parsedContent;
}

function getFile(parsedContent, resources = parsedContent.resources) {
    if (resources === undefined) {
        return parsedContent;
    }
    for (const [key, value] of Object.entries(resources)) {
        if (isGetFile(value)) {
            const file = value.get_file;
            fetch(file)
                .then(res => res.text())
                .then(data => {
                    resources[key] = data;
                })
                .catch(err => {
                    console.log(`Error: ${err.message}`);
                    resources[key] = file;
                });
        } else if (isObject(value)) {
            getFile(parsedContent, value);
        } else if (isArray(value)) {
            value.forEach(item => getFile(parsedContent, item));
        }
    }
    return parsedContent;
}

function listJoin(parsedContent, resources = parsedContent.resources) {
    for (const [key, value] of Object.entries(resources)) {
        if (isListJoin(value)) {
            const delimiter = value.list_join[0];
            const items = value.list_join.slice(1);
            const joined = items
                .flat(Infinity)
                .map(item => (isObject(item) ? JSON.stringify(item) : item.toString()))
                .join(delimiter);
            resources[key] = joined;
        } else if (isObject(value)) {
            listJoin(parsedContent, value);
        } else if (isArray(value)) {
            value.forEach(item => listJoin(parsedContent, item));
        }
    }
    return parsedContent;
}

function isGetParam(value) {
    return value && value.get_param;
}

function isStrReplaceable(value) {
    return value && value.str_replace;
}

function isGetFile(value) {
    return value && value.get_file;
}

function isListJoin(value) {
    return value && value.list_join;
}

function isObject(value) {
    return typeof value === 'object';
}

function isArray(value) {
    return Array.isArray(value);
}

function replaceParams(template, params) {
    let replacedTemplate = template;
    for (const [paramName, paramValue] of Object.entries(params)) {
        const regex = new RegExp(paramName, 'g');
        try {
            replacedTemplate = replacedTemplate.replace(regex, paramValue);
        } catch {
            console.log(`Failed to replace param: ${paramName}`);
        }
    }
    return replacedTemplate;
}

export { getParam, strReplace, getFile, listJoin };
