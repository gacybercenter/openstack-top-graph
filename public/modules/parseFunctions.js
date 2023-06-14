/**
 * Replaces all occurrences of '%index%' in a string or nested object/array with the provided index.
 *
 * @param {*} object - The object/array/string to perform the replacements on.
 * @param {number} index - The index to replace '%index%' with.
 * @return {*} - A new object/array/string with all instances of '%index%' replaced with the provided index.
 */
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

/**
 * Converts an object to an HTML string representation, recursively.
 * Duplicate values for a given key are separated by commas.
 * @param {object} obj - The object to format
 * @param {string} key - The key for the current object, defaults to empty string
 * @param {number} indent - The indentation level, defaults to 0
 * @param {string} parentKey - The key of the parent object, defaults to empty string
 * @param {object} result - The object to store results, defaults to empty object
 * @returns {string} - The HTML string representation of the object
 */
function formatObject(obj, key = '', indent = 0, parentKey = '', result = {}) {
    let html = '';
    let short = '';
    let long = '';
    if (Array.isArray(obj)) {                                                       // If obj is an array: 
        obj.forEach((value) => {                                                    // Iterate over its elements 
            if (value !== '' && value !== '.') {                                    // Ignore empty and dot values
                html += formatObject(value,                                         // Call formatObject recursively on each element
                    `${key}`,
                    indent + 2,
                    parentKey,
                    result);
            }
        });
    } else if (typeof obj === 'object' && obj !== null) {                           // If obj is an object: 
        for (const [objKey, value] of Object.entries(obj)) {                        // Iterate over its key-value pairs and call formatObject recursively on each value
            const currentKey = objKey === 'get_resource' ? parentKey : objKey;      // parentKey for get_resource objects, otherwise objKey
            html += formatObject(value,                                         // Call formatObject recursively on each currentKey entry
                currentKey,
                indent + 2,
                currentKey,
                result);
        }
    } else {
        if (key !== '' && key !== undefined) {
            if (result[key] === undefined) {                                        // If obj is a primitive type: 
                result[key] = [];                                                   // Store it in the result object under the given key
            }
            result[key].push(obj);
        }
    }
    if (key === '') {                                                               // If key is empty, format the result object as an HTML string
        for (const [resultKey, values] of Object.entries(result)) {
            if (values.length > 1) {                                                // If there are multiple values for a given key: 
                long += `<strong>${resultKey}: </strong>${values.join(', ')}<br/>`; // Display them separated by commas
                if (resultKey !== 'template' &&
                    resultKey !== 'user_data_format' &&
                    resultKey !== 'config' &&
                    resultKey !== 'user_data') {
                    short += `<strong>${resultKey}: </strong>${values.join(', ')}<br/>`;
                }
            } else {                                                                // Otherwise, 
                long += `<strong>${resultKey}: </strong>${values[0]}<br/>`;         // Display the single value
                if (resultKey !== 'template' &&
                    resultKey !== 'user_data_format' &&
                    resultKey !== 'config' &&
                    resultKey !== 'user_data') {
                    short += `<strong>${resultKey}: </strong>${values[0]}<br/>`;
                }
            }
        }
    }
    return { short, long };
}
/**
 * Parses html and extracts IP address(es).
 * It finds: ip_address, fixed_ip, and cidr.
 * @param {object} html - The html to be parsed
 * @returns {string} - The IP address(es) in the html
 */
function IpFromHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const strongElements = doc.querySelectorAll('strong');
    let ip = '';

    strongElements.forEach((el) => {                                                // Loops through each html element.
        if (el.textContent.includes('ip_address')) {                                // Gets the ip_address html entries
            ip = el.nextSibling.textContent.trim();
        } else if (el.textContent.includes('fixed_ip')) {                           // Gets the fixed_ip html entries
            ip = el.nextSibling.textContent.trim();
        } else if (el.textContent.includes('cidr')) {                               // Gets the cidr html entries
            ip = el.nextSibling.textContent.trim();
        }
    });
    return ip;
}

export {
    replaceIndex,
    formatObject,
    IpFromHtml
};
