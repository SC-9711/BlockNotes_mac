// Explicit local personal build; the original resources stay outside app.asar.
module.exports={...require('./package.json').build,electronDist:'node_modules/electron/dist',extraResources:[{from:'public/minecraft',to:'minecraft'}],portable:{artifactName:'BlockNotes-Local-${version}-Windows-${arch}.exe'}};
