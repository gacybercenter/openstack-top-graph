import {
    clearSVG,
    getFileType,
    parseFile,
    getTemplateName,
    resolveIntrinsicFunctions,
    parseInputText,
    setTemplateName,
    setConsoleHost
} from "./modules/utilityFunctions.js";

import {
    nodeMap
} from "./modules/nodeMap.js";

import {
    drawNodes
} from "./modules/drawNodes.js";

const fileInput = document.getElementById("file-input");
const textInput = document.getElementById("text-input");

fileInput.addEventListener("change", handleFileSelect, false);
textInput.addEventListener("change", handleTextSelect, false);

/**
 * Processes files inputed into the file container.
 * Can process YAML and JSON Heat Template files.
 * Turns a Heat Template into an interactive topological network graph
 * @param {object} event - The inputted JAML or JSON Heat Template file
 */
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    try {
        clearSVG();

        const fileType = getFileType(file.name);

        const reader = new FileReader();
        reader.onload = handleFileLoad(fileType, file.name, reader);

        reader.readAsText(file, "UTF-8");
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}


/**
 * Returns a function that handles a file load event by parsing the file content,
 * setting the console host, resolving intrinsic functions, mapping nodes and links,
 * and drawing these nodes and links.
 *
 * @param {string} fileType - the type of the loaded file.
 * @param {string} fileName - the name of the loaded file.
 * @param {FileReader} reader - the FileReader object used to read the file.
 * @return {function} a function that handles a file load event.
 */
function handleFileLoad(fileType, fileName, reader) {
    return function (event) {
        const fileContent = event.target.result;
        const parsedContent = parseFile(fileType, fileContent);
        const templateName = getTemplateName(fileName);

        setConsoleHost(parsedContent.parameters);
        setTemplateName(parsedContent, templateName);

        const templateObj = resolveIntrinsicFunctions(parsedContent);
        const nodesAndLinks = nodeMap(templateObj, templateName);

        drawNodes(nodesAndLinks, templateObj.description);
    }
}

/**
 * Processes text inputed into the text container.
 * Can process YAML and JSON Heat Template text.
 * Turns a Heat Template into an interactive topological network graph
 * @param {object} event - The inputted JAML or JSON Heat Template text
 */
function handleTextSelect(event) {
    try {
        clearSVG();

        const inputText = event.target.value;
        if (!inputText) return;

        const parsedContent = parseInputText(inputText);

        const file = { name: 'TEMPLATE' };
        if (parsedContent.parameters) {
            parsedContent.parameters['OS::stack_name'] = {
                type: 'string',
                default: file.name,
            };
        }

        setConsoleHost(parsedContent.parameters);

        const templateObj = resolveIntrinsicFunctions(parsedContent);
        const nodesAndLinks = nodeMap(templateObj, file.name);

        drawNodes(nodesAndLinks, templateObj.description);
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}
