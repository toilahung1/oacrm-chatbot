
const fs = require('fs');
const content = fs.readFileSync('ads.html', 'utf8');
let lines = content.split('\n');

let openDivs = 0;
for (let i = 3951; i < 4596; i++) {
    let line = lines[i];
    let opens = (line.match(/<div/g) || []).length;
    let closes = (line.match(/<\/div>/g) || []).length;
    openDivs += opens - closes;
}
console.log(`Campaigns view (3952-4596) openDivs = ${openDivs}`);
