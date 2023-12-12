/**
 * Recursively searches through parsedContent for resources 
 * containing a get_param:  attribute. If found, replaces it 
 * with the default value of the corresponding parameter, 
 * taken from parsedContent. 
 *
 * @param {object} parsedContent - The content to search through.
 * @param {object} [resources=parsedContent.resources] - The current resources being searched.
 * @param {object} [parameters=parsedContent.parameters] - The parameters to look up.
 * @returns {object} The modified parsedContent object.
 */
function stackName(parsedContent, name, resources = parsedContent.resources) {
    if (!resources || !parsedContent.resources) return parsedContent;

    for (const [key, value] of Object.entries(resources)) {
        if (isStackName(value)) {
            if (value.get_param && value.get_param === "OS::stack_name") {
                resources[key] = name;
            }
        } else if (isObject(value)) {
            stackName(parsedContent, name, value);
        } else if (isArray(value)) {
            value.forEach(item => stackName(parsedContent, name, item));
        }
    }
    return parsedContent;
}

/**
 * Recursively searches through parsedContent for resources 
 * containing a get_param attribute. If found, replaces it 
 * with the default value of the corresponding parameter, 
 * taken from parsedContent. 
 *
 * @param {object} parsedContent - The content to search through.
 * @param {object} [resources=parsedContent.resources] - The current resources being searched.
 * @param {object} [parameters=parsedContent.parameters] - The parameters to look up.
 * @returns {object} The modified parsedContent object.
 */
function getParam(parsedContent, resources = parsedContent.resources, parameters = parsedContent.parameters) {
    if (!resources || !parsedContent.resources) return parsedContent;

    for (const [key, value] of Object.entries(resources)) {
        if (isGetParam(value)) {
            const parameterName = value.get_param;
            const parameter = parameters[parameterName];
            if (parameter !== undefined) {
                resources[key] = parameters[parameterName].default || parameters[parameterName];
            }
        } else if (isObject(value)) {
            getParam(parsedContent, value, parameters);
        } else if (isArray(value)) {
            value.forEach(item => getParam(parsedContent, item, parameters));
        }
    }
    return parsedContent;
}

/**
 * Resolves the IDs in the parsed content by replacing them with the corresponding resource names.
 *
 * @param {Object} parsedContent - The parsed content object.
 * @param {Object} [resources=parsedContent.resources] - The resources object.
 * @param {Object} [parameters=parsedContent.parameters] - The parameters object.
 * @return {Object} The parsed content object with resolved IDs.
 */
function resolveID(parsedContent, resources = parsedContent.resources, parameters = parsedContent.parameters) {
    if (!resources || !parsedContent.resources) return parsedContent;

    for (const [key, value] of Object.entries(resources)) {
        if (isUUID(value)) {
            const resourceName = findResourceName(value, parameters);
            if (resourceName) {
                resources[key] = { 'get_resource': resourceName };
            }
        } else if (isObject(value)) {
            resolveID(parsedContent, value, parameters);
        } else if (isArray(value)) {
            value.forEach(item => resolveID(parsedContent, item, parameters));
        }
    }
    return parsedContent;
}

/**
 * Replaces string templates in the given parsed content object with their corresponding parameters.
 *
 * @param {object} parsedContent - the content object to search for string templates and replace them
 * @param {object} [resources=parsedContent.resources] - the object containing the string templates to search for and replace
 * @return {object} the parsed content object with the string templates replaced with their corresponding parameters
 */
function strReplace(parsedContent, resources = parsedContent.resources) {
    if (!resources || !parsedContent.resources) return parsedContent;

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

/**
 * Returns a parsedContent with updated resources data.
 *
 * @param {Object} parsedContent - the parsed data object
 * @param {Object} [resources=parsedContent.resources] - the resources object to update
 * @return {Object} the updated parsedContent object
 */
function getFile(parsedContent, resources = parsedContent.resources) {
    if (!resources || !parsedContent.resources) return parsedContent;

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

/**
 * Recursively joins arrays specified with the 'list_join' key in a nested object structure.
 *
 * @param {Object} parsedContent - The parsed content to join.
 * @param {Object} [resources=parsedContent.resources] - The resources object.
 * @return {Object} The parsed content with joined arrays.
 */
function listJoin(parsedContent, resources = parsedContent.resources) {
    if (!resources || !parsedContent.resources) return parsedContent;

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

/**
 * Checks if the given value has a 'get_param' property.
 *
 * @param {any} value - The value to be checked.
 * @return {boolean} Returns true if the value has a 'get_param' property, false otherwise.
 */
function isStackName(value) {
    return value && value.get_param && value.get_param === "OS::stack_name";
}

/**
 * Checks if the given value has a 'get_param' property.
 *
 * @param {any} value - The value to be checked.
 * @return {boolean} Returns true if the value has a 'get_param' property, false otherwise.
 */
function isGetParam(value) {
    return value && value.get_param;
}

/**
 * Checks if a given value is a valid UUID.
 *
 * @param {any} value - The value to be checked.
 * @return {boolean} Returns true if the value is a valid UUID, false otherwise.
 */
function isUUID(value) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
}

/**
 * Finds the resource name based on the given UUID and parameters.
 *
 * @param {string} uuid - The UUID to search for.
 * @param {object} parameters - The parameters object to search in.
 * @return {string|null} - The resource name, or null if not found.
 */
function findResourceName(uuid, parameters) {
    for (const [paramKey, paramValue] of Object.entries(parameters)) {
        if (paramValue === uuid || paramValue.default === uuid) {
            return paramKey.replace(/_id$/, '');
        }
    }
    return null;
}

/**
 * Checks if the given value has a "str_replace" property that can be used for string replacement.
 *
 * @param {any} value - The value to check.
 * @return {boolean} Returns true if the value has a "str_replace" property, false otherwise.
 */
function isStrReplaceable(value) {
    return value && value.str_replace;
}

/**
 * Checks if the input value has a 'get_file' property.
 *
 * @param {*} value - The value to check if it has a 'get_file' property.
 * @returns {boolean} Returns true if the input value has a 'get_file' property, else false.
 */
function isGetFile(value) {
    return value && value.get_file;
}

/**
 * Checks if the given value has a "list_join" property.
 *
 * @param {any} value - The value to check.
 * @return {boolean} Returns true if the value has a "list_join" property, else false.
 */
function isListJoin(value) {
    return value && value.list_join;
}

/**
 * Determines if the given value is an object.
 *
 * @param {*} value - The value to check.
 * @return {boolean} Returns `true` if the value is an object, else `false`.
 */
function isObject(value) {
    return typeof value === 'object';
}

/**
 * Returns a boolean indicating whether the input value is an array or not.
 *
 * @param {any} value - The value to be checked for array type.
 * @return {boolean} - A boolean indicating whether the input value is an array or not.
 */
function isArray(value) {
    return Array.isArray(value);
}

/**
 * Replaces placeholders in a template string with corresponding values from a given object.
 *
 * @param {string} template - The template string with placeholders to be replaced.
 * @param {Object} params - An object containing key-value pairs where the key is the placeholder name and the value is its replacement.
 * @return {string} - The template string with placeholders replaced by corresponding values.
 */
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

export { stackName, getParam, resolveID, strReplace, getFile, listJoin };
