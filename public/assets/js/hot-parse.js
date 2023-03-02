function handleFileSelect(event) {
    const file = event.target.files[0];

    // Check if file is YAML or JSON format
    const isYaml = file.name.endsWith(".yaml") || file.name.endsWith(".yml");
    const fileType = isYaml ? "yaml" : "json";

    const reader = new FileReader();
    reader.onload = function (event) {
        try {
            const fileContent = event.target.result;
            const parsedContent = fileType === "yaml" ? jsyaml.load(fileContent) : JSON.parse(fileContent);
            // do something with parsedContent, e.g. send it to the server
            ;
            console.log(parsedContent);
        } catch (error) {
            console.error(`Error parsing ${fileType} file: ${error}`);
        }
    };
    reader.readAsText(file, "UTF-8");
}

const fileInput = document.getElementById("file-input");
fileInput.addEventListener("change", handleFileSelect, false);