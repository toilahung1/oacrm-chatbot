
const fs = require('fs');
const content = fs.readFileSync('ads.html', 'utf8');

let openDivs = 0;
let lines = content.split('\n');

lines.forEach((line, i) => {
    let opens = (line.match(/<div/g) || []).length;
    let closes = (line.match(/<\/div>/g) || []).length;
    openDivs += opens - closes;
    if (i % 1000 === 0 || i === lines.length - 1) {
        console.log(`Line ${i+1}: openDivs = ${openDivs}`);
    }
    if (openDivs < 0) {
        console.log(`!!! NEGATIVE at line ${i+1}: openDivs = ${openDivs}`);
        // openDivs = 0; // Don't reset, let's see how deep it goes
    }
});
