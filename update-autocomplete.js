const fs = require('fs');
const path = require('path');

const files = [
  path.join('js', 'ui', 'namesModal.js'),
  'index.html'
];

// Define the pattern to match with regex - more flexible than exact string matching
const oldPattern = [
  '\\s*var div = document\\.createElement\\("div"\\);',
  '\\s*div\\.innerHTML = "<strong>" \\+ match\\.substr\\(0, val\\.length\\) \\+ "</strong>" \\+ match\\.substr\\(val\\.length\\);',
  '\\s*div\\.innerHTML \\+= "<input type=\\'hidden\\' value=\\'' \\+ match \\+ '\\'>";'
].join('\\s*\\r?\\n\\s*'); // Tolerates both \r\n and \n, plus whitespace variations

const newCode = [
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
].join('\n');

const regex = new RegExp(oldPattern, 'g');

for (const file of files) {
  const absPath = path.resolve(file);
  let text = fs.readFileSync(absPath, 'utf8');
  
  if (!regex.test(text)) {
    console.error(`pattern not found in ${file}`);
    process.exitCode = 1;
    continue;
  }
  
  // Reset regex for replacement
  regex.lastIndex = 0;
  text = text.replace(regex, newCode);
  fs.writeFileSync(absPath, text);
  console.log(`Updated ${file}`);
}
