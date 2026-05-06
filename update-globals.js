const fs = require('fs');
let css = fs.readFileSync('src/app/globals.css', 'utf8');

css = css.replace(/\.sidebar \{\s*order:\s*3;\s*width:\s*100% !important;\s*height:\s*64px !important;\s*border-right:\s*none !important;\s*border-top:\s*1px solid var\(--bg-border-subtle\);\s*position:\s*fixed;\s*bottom:\s*0;\s*left:\s*0;\s*z-index:\s*100;\s*\}/, '.sidebar { display: none !important; }');

fs.writeFileSync('src/app/globals.css', css);
console.log('globals.css sidebar query updated');
