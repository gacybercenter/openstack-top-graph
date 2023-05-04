/**
 * Converts a parsed JSON or YAML object to a text string representation.
 * @param {object} data - The parsed JSON or YAML object to format
 * @param {number} indent - The indentation level, defaults to 0
 * @returns {string} - The text string representation of the object
 */
function formatDataToText(data, indent = 0) {
    let text = '';
    if (Array.isArray(data)) { // If data is an array:
        data.forEach((value) => { // Iterate over its elements
            text += ' '.repeat(indent) + '- ' + formatDataToText(value, indent + 2).replace(/\n/g, '\n' + ' '.repeat(indent + 2)) + '\n'; // Call formatDataToText recursively on each element, add an indentation level and a dash for each item, and replace new lines with the appropriate indentation
        });
    } else if (typeof data === 'object' && data !== null) { // If data is an object:
        for (const [key, value] of Object.entries(data)) { // Iterate over its key-value pairs and call formatDataToText recursively on each value
            text += ' '.repeat(indent) + '- ' + key + ': ' + formatDataToText(value, indent + 2).replace(/\n/g, '\n' + ' '.repeat(indent + 2)) + '\n'; // Add an indentation level, the key and a colon, and display the key-value pair on a new line, replacing new lines with the appropriate indentation
        }
    } else { // If data is a primitive type:
        text += data; // Display it as is
    }
    return text;
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
            if (                                                                    // Ignore specific keys
                currentKey !== 'template' &&
                currentKey !== 'get_param' &&
                currentKey !== 'user_data_format' &&
                currentKey !== 'list_join' &&
                currentKey !== 'name'
            ) {
                html += formatObject(value,                                         // Call formatObject recursively on each currentKey entry
                    currentKey,
                    indent + 2,
                    currentKey,
                    result);
            } else if (currentKey === 'list_join') {                                // If currentKey is list_join, use parentKey
                html += formatObject(value,                                         // Call formatObject recursively on each parentKey entry
                    parentKey,
                    indent + 2,
                    parentKey,
                    result);
            }
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
                html += `<strong>${resultKey}: </strong>${values.join(', ')}<br/>`; // Display them separated by commas
            } else {                                                                // Otherwise, 
                html += `<strong>${resultKey}: </strong>${values[0]}<br/>`;         // Display the single value
            }
        }
    }
    return html;
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
    formatDataToText,
    formatObject,
    IpFromHtml
};
