
const fs = require('fs');
const content = fs.readFileSync('ads.html', 'utf8');

let openDivs = 0;
let lines = content.split('\n');

for (let i = 0; i < 5306; i++) {
    let line = lines[i];
    let opens = (line.match(/<div/g) || []).length;
    let closes = (line.match(/<\/div>/g) || []).length;
    openDivs += opens - closes;
    if (openDivs < 0) {
        console.log(`!!! NEGATIVE at line ${i+1}: openDivs = ${openDivs}`);
        openDivs = 0;
    }
}
console.log(`Final open divs at end of HTML (line 5306): ${openDivs}`);
