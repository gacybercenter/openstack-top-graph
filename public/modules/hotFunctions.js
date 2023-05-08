function getParam(parsedContent, obj = parsedContent.resources, parameters = parsedContent.parameters) {
    for (const [key, value] of Object.entries(obj)) {
        if (value.get_param) {
            const parameterName = value.get_param;
            if (parameters[parameterName] !== undefined) {
                obj[key] = parameters[parameterName].default;
            }
        }
        else if (typeof value === 'object') {
            getParam(parsedContent, value, parameters);
        }
        else if (Array.isArray(value)) {
            value.forEach((item) => {
                getParam(parsedContent, item, parameters);
            });
        }
    }
    return parsedContent;
}

function strReplace(parsedContent, obj = parsedContent.resources) {
    for (const [key, value] of Object.entries(obj)) {
        if (value.str_replace) {
            const template = value.str_replace.template;
            const params = value.str_replace.params;
            let replacedTemplate = template;
            for (const [paramName, param] of Object.entries(params)) {
                const regex = new RegExp(paramName, 'g');
                try {
                    replacedTemplate = replacedTemplate.replace(regex, param);
                } catch {
                    console.log("failed to replace param: " + paramName);
                }
            }
            obj[key] = replacedTemplate;
            obj['params'] = params;
        } else if (typeof value === 'object') {
            strReplace(parsedContent, value);
        } else if (Array.isArray(value)) {
            value.forEach((item) => {
                strReplace(parsedContent, item);
            });
        }
    }
    return parsedContent;
}

function getFile(parsedContent, obj = parsedContent.resources) {
    for (const [key, value] of Object.entries(obj)) {
        if (value.get_file) {
            const file = value.get_file;
            fetch(file)
                .then(res => res.text())
                .then(data => {
                    obj[key] = data;
                })
                .catch(err => {
                    console.log(`Error: ${err.message}`);
                    obj[key] = file;
                });
        }
        else if (typeof value === 'object') {
            getFile(parsedContent, value);
        }
        else if (Array.isArray(value)) {
            value.forEach((item) => {
                getFile(parsedContent, item);
            });
        }
    }
    return parsedContent;
}

function listJoin(parsedContent, obj = parsedContent.resources) {
    for (const [key, value] of Object.entries(obj)) {
        if (value.list_join) {
            const delimiter = value.list_join[0];
            const items = value.list_join.slice(1);
            const joined = items
                .flat(Infinity)
                .map(item => {
                    if (typeof item === 'object') {
                        return JSON.stringify(item);
                    } else {
                        return item.toString();
                    }
                })
                .join(delimiter);
            obj[key] = joined;
        }
        else if (typeof value === 'object') {
            listJoin(parsedContent, value);
        }
        else if (Array.isArray(value)) {
            value.forEach((item) => {
                listJoin(parsedContent, item);
            });
        }
    }
    return parsedContent;
}


export {
    getParam,
    strReplace,
    getFile,
    listJoin
};
