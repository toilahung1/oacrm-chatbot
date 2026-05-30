
const fs = require('fs');
const content = fs.readFileSync('ads.html', 'utf8');
let lines = content.split('\n');

function checkRange(start, end) {
    let openDivs = 0;
    for (let i = start - 1; i < end; i++) {
        let line = lines[i];
        let opens = (line.match(/<div/g) || []).length;
        let closes = (line.match(/<\/div>/g) || []).length;
        openDivs += opens - closes;
    }
    console.log(`Range ${start}-${end}: openDivs = ${openDivs}`);
}

checkRange(2931, 3036); // view-overview
checkRange(3041, 3179); // view-gzchat
checkRange(3205, 3350); // view-orders
checkRange(3361, 3520); // view-drive
checkRange(3531, 3940); // view-gmail
checkRange(3952, 5300); // view-campaigns
