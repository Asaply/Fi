const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.{js,jsx}');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    content = content.replace(/backgroundColor:\s*['"]#(1a1a1a|2a2a2a|111111|1c1c1c|000000|ffffff|f5f5f5|fff)['"]/g, "backgroundColor: 'var(--bg-surface)'");
    content = content.replace(/background:\s*['"]#(1a1a1a|2a2a2a|111111|1c1c1c|000000|ffffff|f5f5f5|fff)['"]/g, "background: 'var(--bg-surface)'");
    content = content.replace(/border:\s*['"]1px solid #(2a2a2a|333333|111111)['"]/g, "border: '1px solid var(--border-color)'");
    content = content.replace(/color:\s*['"]#(ffffff|fff|f5f5f5|000)['"]/g, "color: 'var(--text-primary)'");
    content = content.replace(/color:\s*['"]#(aaaaaa|aaa|888888|888|555|555555)['"]/g, "color: 'var(--text-secondary)'");

    // Fix other hardcoded labels
    content = content.replace(/color:\s*['"]var\(--text-muted\)['"]/g, "color: 'var(--text-secondary)'");

    if (original !== content) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Fixed colors in', file);
    }
});
