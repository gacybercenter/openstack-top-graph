import {
    parseFile,
    getFileType
} from "./utilityFunctions.js";

/**
 * Moves the environment files to the front of the array.
 *
 * @param {Array} files - The array of files to be sorted.
 * @return {Array} - The sorted array with environment files at the front.
 */
function moveEnvFilesToFront(files) {
    const envFiles = [];
    const otherFiles = [];

    for (const file of files) {
        if (file.name.startsWith('env.')) {
            envFiles.push(file);
        } else {
            otherFiles.push(file);
        }
    }

    return [...envFiles, ...otherFiles];
}

/**
 * Asynchronously reads a file and returns its content.
 *
 * @param {File} file - The file to be read.
 * @param {string} fileType - The type of the file.
 * @return {Promise} A promise that resolves with the content of the file.
 */
function readFileAsync(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const fileType = getFileType(file.name);
            const content = parseFile(fileType, event.target.result);
            resolve(content);
        };
        reader.onerror = (event) => {
            reject(new Error('Error reading file.'));
        };
        reader.readAsText(file, 'UTF-8');
    });
}


/**
 * Merges the contents of the source object into the target object.
 *
 * @param {object} target - The target object to merge into.
 * @param {object} source - The source object to merge from.
 */
function mergeContents(target, source) {
    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            const targetValue = target[key];
            const sourceValue = source[key];

            if (key === 'resources' && typeof targetValue === 'object' && typeof sourceValue === 'object') {
                const sharedKey = Object.keys(targetValue).find(k => sourceValue.hasOwnProperty(k));
                if (sharedKey) {
                    alert(`Duplicate resource found: ${sharedKey}\n(This resource will be ignored!)`);
                }
            }
            if (targetValue === undefined) {
                target[key] = sourceValue;
            } else if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
                target[key] = Array.from(new Set([...targetValue, ...sourceValue]));
            } else if (typeof targetValue === 'object' && typeof sourceValue === 'object') {
                mergeContents(targetValue, sourceValue);
            }
        }
    }
}

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
    const excluded = ['template', 'user_data_format', 'config', 'user_data'];
    let short = '';
    let long = '';
    for (const [resultKey, values] of Object.entries(result)) {
        if (values.length > 1) {
            long += `<strong>${resultKey}: </strong>${values.join(', ')}<br/>`;
            if (excluded.indexOf(resultKey) === -1) {
                short += `<strong>${resultKey}: </strong>${values.join(', ')}<br/>`;
            }
        } else {
            long += `<strong>${resultKey}: </strong>${values[0]}<br/>`;
            if (excluded.indexOf(resultKey) === -1) {
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
    moveEnvFilesToFront,
    readFileAsync,
    mergeContents,
    replaceIndex,
    formatObject,
    formatObjectToHTML,
    HTMLToIp
};
