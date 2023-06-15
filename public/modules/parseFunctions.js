/**
 * Replaces any occurrence of "%index%" in a string or in an object's string values with the provided index,
 * recursively replacing values in arrays and objects.
 *
 * @param {string|Array|object} obj - The object to replace the index in.
 * @param {number} index - The index to replace.
 * @return {string|Array|object} - The object with the updated index.
 */
function replaceIndex(obj, index) {
    if (typeof obj === 'string') {
        return obj.replace('%index%', index);
    } else if (Array.isArray(obj)) {
        return obj.map(item => replaceIndex(item, index));
    } else if (typeof obj === 'object' && obj !== null) {
        const newObj = {};
        for (const [key, value] of Object.entries(obj)) {
            newObj[key] = replaceIndex(value, index);
        }
        return newObj;
    } else {
        return obj;
    }
}

/**
 * Recursively formats an object into an array of values or an object of arrays.
 *
 * @param {object|array} obj - The object or array to be formatted.
 * @param {string} [key=''] - The key of the current object in the parent object.
 * @param {number} [indent=0] - The number of spaces to indent the formatted string.
 * @param {string} [parentKey=''] - The key of the parent object.
 * @param {object} [result={}] - The resulting object or array.
 * @return {object} The formatted object or array.
 */
function formatObject(obj, key = '', indent = 0, parentKey = '', result = {}) {
    let html = '';
    if (Array.isArray(obj)) {
        obj.forEach((value) => {
            if (value !== '' && value !== '.') {
                html += formatObject(value, key, indent + 2, parentKey, result);
            }
        });
    } else if (typeof obj === 'object' && obj !== null) {
        for (const [objKey, value] of Object.entries(obj)) {
            const currentKey = objKey === 'get_resource' ? parentKey : objKey;
            html += formatObject(value, currentKey, indent + 2, currentKey, result);
        }
    } else {
        if (key && result[key] === undefined) {
            result[key] = [];
        }
        if (key) {
            result[key].push(obj);
        }
    }
    return result;
}

/**
 * Formats an object to an HTML string, returning both a short and long version. 
 *
 * @param {Object} result - The object to format.
 * @return {Object} An object with two properties: short and long. Both are HTML strings.
 */
function formatObjectToHTML(result) {
    let short = '';
    let long = '';
    for (const [resultKey, values] of Object.entries(result)) {
        if (values.length > 1) {
            long += `<strong>${resultKey}: </strong>${values.join(', ')}<br/>`;
            if (['template', 'user_data_format', 'config', 'user_data'].indexOf(resultKey) === -1) {
                short += `<strong>${resultKey}: </strong>${values.join(', ')}<br/>`;
            }
        } else {
            long += `<strong>${resultKey}: </strong>${values[0]}<br/>`;
            if (['template', 'user_data_format', 'config', 'user_data'].indexOf(resultKey) === -1) {
                short += `<strong>${resultKey}: </strong>${values[0]}<br/>`;
            }
        }
    }
    return { short, long };
}

/**
 * Parses HTML and extracts IP address(es).
 * It finds: ip_address, fixed_ip, and cidr.
 * @param {string} html - The HTML to be parsed.
 * @returns {string} - The IP address(es) in the HTML.
 */
function HTMLToIp(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const strongElements = doc.querySelectorAll('strong');
    let ip = '';

    for (const el of strongElements) {
        if (el.textContent.includes('ip_address') ||
            el.textContent.includes('fixed_ip') ||
            el.textContent.includes('cidr')) {
            ip = el.nextSibling.textContent.trim();
        }
    }
    return ip;
}

export {
    replaceIndex,
    formatObject,
    formatObjectToHTML,
    HTMLToIp
};
