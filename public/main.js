import {
    clearSVG,
    getTemplateName,
    resolveIntrinsicFunctions,
    parseInputText,
    setConsoleHost
} from "./modules/utilityFunctions.js";

import {
    nodeMap
} from "./modules/nodeMap.js";

import {
    drawNodes
} from "./modules/drawNodes.js";

import {
    stackName
} from "./modules/hotFunctions.js";

import {
    moveEnvFilesToFront,
    readFileAsync,
    mergeContents
} from "./modules/parseFunctions.js";

const fileInput = document.getElementById("file-input");
const textInput = document.getElementById("text-input");
const mergeNodes = document.getElementById("mergeNodes");

fileInput.addEventListener("change", handleFileSelect, false);
textInput.addEventListener("change", handleTextSelect, false);
mergeNodes.addEventListener("click", recallHandleFileSelect, false);
mergeNodes.addEventListener("click", recallHandleTextSelect, false);

let lastEvent;

/**
 * Handles the file selection event.
 *
 * @param {Event} event - The file selection event.
 * @return {void} This function does not return anything.
 */
function handleFileSelect(event) {
    let files = event.target.files;
    if (!files) return;

    clearSVG();

    files = moveEnvFilesToFront(files);
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
            const name = getTemplateName([file]);
            let content = await readFileAsync(file);

            content = stackName(content, name);
            mergeContents(fileContent, content);
        }
        handleFileLoad(fileContent);
    }

    lastEvent = event; // Store the current event as the last event
}

// Recall the function with the last event
function recallHandleFileSelect() {
    if (lastEvent) {
        handleFileSelect(lastEvent);
    }
}

/**
 * Handles the file load event.
 *
 * @param {object} fileContent - The content of the file being loaded.
 */
function handleFileLoad(fileContent) {
    setConsoleHost(fileContent.parameters);
    resolveIntrinsicFunctions(fileContent);

    const nodesAndLinks = nodeMap(fileContent);
    drawNodes(nodesAndLinks, fileContent.description);
}

/**
 * Processes text inputed into the text container.
 * Can process YAML and JSON Heat Template text.
 * Turns a Heat Template into an interactive topological network graph
 * @param {object} event - The inputted JAML or JSON Heat Template text
 */
function handleTextSelect(event) {
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

    resolveIntrinsicFunctions(parsedContent);
    const nodesAndLinks = nodeMap(parsedContent);

    drawNodes(nodesAndLinks, parsedContent.description);
    
    lastEvent = event; // Store the current event as the last event
}

function recallHandleTextSelect() {
    if (lastEvent) {
        handleTextSelect(lastEvent);
    }
}
