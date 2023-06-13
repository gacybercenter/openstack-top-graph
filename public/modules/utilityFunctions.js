import {
    getParam,
    strReplace,
    getFile,
    listJoin
} from "./hotFunctions.js";

/**
 * Removes the SVG and tooltip elements from the DOM if they exist.
 *
 * @return {undefined} This function does not return anything.
 */
function clearSVG() {
    const svg = document.querySelector('svg');
    const tooltip = document.querySelector('.tooltip');
    if (svg) svg.remove();
    if (tooltip) tooltip.remove();
}

/**
 * Returns the file type of the given file name. The file type can either be 
 * yaml or json.
 *
 * @param {string} fileName - The name of the file including the file extension
 * @return {string} The file type of the given file name (yaml or json)
 */
function getFileType(fileName) {
    const isYaml = fileName.endsWith(".yaml") || fileName.endsWith(".yml");
    return isYaml ? "yaml" : "json";
}

/**
 * Parses a file of either yaml or JSON format and returns its content in
 * JavaScript object format.
 *
 * @param {string} fileType - The type of file being parsed. Either "yaml" or "JSON".
 * @param {string} fileContent - The content of the file to be parsed.
 * @return {object} The content of the file in JavaScript object format.
 */
function parseFile(fileType, fileContent) {
    return fileType === "yaml" ? jsyaml.load(fileContent) : JSON.parse(fileContent);
}

/**
 * Returns the template name from a given file name by splitting the file name
 * at the first period and returning the first part.
 *
 * @param {string} fileName - The name of the file to extract the template name from.
 * @return {string} The template name extracted from the file name.
 */
function getTemplateName(fileName) {
    return fileName.split('.')[0];
}

/**
 * Resolves intrinsic functions in parsed content.
 *
 * @param {Object} parsedContent - The parsed content with intrinsic functions.
 * @return {Object} The resolved template object.
 */
function resolveIntrinsicFunctions(parsedContent) {
    let templateObj = getParam(parsedContent);
    templateObj = getFile(templateObj);
    templateObj = strReplace(templateObj);
    templateObj = listJoin(templateObj);
    return templateObj;
}

/**
 * Parses input text as YAML or JSON.
 *
 * @param {string} inputText - The input text to parse.
 * @return {object} The parsed object from the input text.
 */
function parseInputText(inputText) {
    return jsyaml.safeLoad(inputText) || JSON.parse(inputText);
}

/**
 * Sets the template name in the parsedContent object.
 *
 * @param {object} parsedContent - The content to modify.
 * @param {string} templateName - The name of the template.
 * @return {object} The modified parsedContent object.
 */
function setTemplateName(parsedContent, templateName) {
    if (parsedContent.parameters) {
        parsedContent.parameters['OS::stack_name'] = { type: 'string', default: templateName };
    return parsedContent;
    }
}

/**
 * Sets the console host URL and displays a button and a link to it.
 *
 * @param {object} parameters - An object containing the console host URL.
 * @param {string} parameters.console_host - The URL for the console host.
 * @return {void} This function does not return anything.
 */
function setConsoleHost(parameters) {
    if (parameters.console_host) {
        const url = parameters.console_host;

        const consoleHostButton = document.getElementById('console_host_button');
        consoleHostButton.style.display = 'block';

        const consoleHostLink = document.getElementById('console_host_link');
        consoleHostLink.url = url;
    }
}

/**
 * Creates duplicate nodes on the graph by adding new nodes and links.
 *
 * @param {Object} duplicateNode - The node to be duplicated.
 * @param {Array} nodes - The array of nodes in the graph.
 * @param {Array} links - The array of links between nodes in the graph.
 * @param {Object} amounts - An object containing the count of each type of node in the graph.
 */
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
    clearSVG,
    getFileType,
    parseFile,
    getTemplateName,
    resolveIntrinsicFunctions,
    parseInputText,
    setTemplateName,
    setConsoleHost,
    createDuplicateNodes
};
