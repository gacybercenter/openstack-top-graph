import {
    clearSVG,
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

import {
    moveEnvFilesToFront,
    readFileAsync,
    mergeContents
} from "./modules/parseFunctions.js";

const fileInput = document.getElementById("file-input");
const textInput = document.getElementById("text-input");

fileInput.addEventListener("change", handleFileSelect, false);
textInput.addEventListener("change", handleTextSelect, false);

function handleFileSelect(event) {
/**
 * Handles the file selection event.
 *
 * @param {Event} event - The file selection event.
 * @return {void} This function does not return anything.
 */
    let files = event.target.files;
    if (!files) return;

    clearSVG();
    const fileName = getTemplateName(files)

    files = moveEnvFilesToFront(files)
    let fileContent = {};
    readMultiFiles(files);

    /**
     * Reads multiple files and merges their contents.
     *
     * @param {Array} files - An array of file paths to read.
     * @return {Promise} A promise that resolves when all files have been read and merged.
     */
    async function readMultiFiles(files) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const content = await readFileAsync(file);
            mergeContents(fileContent, content);
        }
        handleFileLoad(fileContent, fileName)
    }
}


/**
 * Handles the file load event.
 *
 * @param {object} fileContent - The content of the file being loaded.
 * @param {string} templateName - The name of the template to be used.
 */
function handleFileLoad(fileContent, templateName) {
    setConsoleHost(fileContent.parameters);
    setTemplateName(fileContent, templateName);

    const templateObj = resolveIntrinsicFunctions(fileContent);
    const nodesAndLinks = nodeMap(templateObj, templateName);

    drawNodes(nodesAndLinks, templateObj.description);
}

/**
 * Processes text inputed into the text container.
 * Can process YAML and JSON Heat Template text.
 * Turns a Heat Template into an interactive topological network graph
 * @param {object} event - The inputted JAML or JSON Heat Template text
 */
function handleTextSelect(event) {
    try {
        const inputText = event.target.value;
        if (!inputText) return;

        clearSVG();
        const parsedContent = parseInputText(inputText);

        setConsoleHost(parsedContent.parameters);
        const file = { name: 'TEMPLATE' };
        if (parsedContent.parameters) {
            parsedContent.parameters['OS::stack_name'] = {
                type: 'string',
                default: file.name,
            };
        }

        const templateObj = resolveIntrinsicFunctions(parsedContent);
        const nodesAndLinks = nodeMap(templateObj, file.name);

        drawNodes(nodesAndLinks, templateObj.description);
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}
