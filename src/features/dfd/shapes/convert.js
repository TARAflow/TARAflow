let fs = require('fs')
let { decode } = require('html-entities')
let pako = require('pako')


let fileToProcess = process.argv[2]
if (!fileToProcess) {
    writeStderr('Usage: node convert.js PATH_TO_FILE\n')
    writeStderr('Additionally, you may redirect stdout to a JSON file:\n')
    writeStderr('node convert.js PATH_TO_FILE > xyz.json')
    process.exit(1)
} else {
    writeStderr(`Processing ${fileToProcess}\n\n`)
    processFile(fileToProcess)
}

function processFile(filePath) {
    let file = fs.readFileSync(filePath, 'utf8')
    let noXML = file.replace('<mxlibrary>', '').replace('</mxlibrary>', '')
    let jsonLibrary = JSON.parse(noXML)
    writeStderr(`${jsonLibrary.length} elements to process\n`)
    let processed = processLib(jsonLibrary)
    writeStderr('done')
    writeStdout(JSON.stringify(processed))
}

function processLib(jsonLib) {
    return jsonLib.map(cleanLibElement)
}

function cleanLibElement(el, i) {
    let htmlEntitiesRemoved = decode(el.xml)
    let uriEncoded = encodeURIComponent(htmlEntitiesRemoved)
    let compressed = String.fromCharCode.apply(null, new Uint8Array(pako.deflateRaw(uriEncoded)));
    let base64Encoded = btoa(compressed)

    el.xml = base64Encoded

    writeStderr(`${i}...`)

    return el
}

function writeStderr(msg) {
    process.stderr.write(msg)
}

function writeStdout(msg) {
    process.stdout.write(msg)
}
