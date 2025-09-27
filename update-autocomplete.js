const fs = require('fs');
const path = require('path');

const files = [
  path.join('js', 'ui', 'namesModal.js'),
  'index.html'
];

const oldLines = [
  '      var div = document.createElement("div");',
  '      div.innerHTML = "<strong>" + match.substr(0, val.length) + "</strong>" + match.substr(val.length);',
  '      div.innerHTML += "<input type=\'hidden\' value=\'' + match + '\'>";'
];

const newLines = [
  '      var div = document.createElement("div");',
  '      var strong = document.createElement("strong");',
  '      strong.textContent = match.substr(0, val.length);',
  '      div.appendChild(strong);',
  '      var remainderText = document.createTextNode(match.substr(val.length));',
  '      div.appendChild(remainderText);',
  '      var hiddenInput = document.createElement("input");',
  '      hiddenInput.type = "hidden";',
  '      hiddenInput.value = match;',
  '      div.appendChild(hiddenInput);'
];

const search = oldLines.join('\r\n');
const replacement = newLines.join('\r\n');

for (const file of files) {
  const absPath = path.resolve(file);
  let text = fs.readFileSync(absPath, 'utf8');
  if (!text.includes(search)) {
    console.error(`pattern not found in ${file}`);
    process.exitCode = 1;
    continue;
  }
  text = text.replace(search, replacement);
  fs.writeFileSync(absPath, text);
}
