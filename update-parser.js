const fs = require('fs');

// --- 1. statementParser.js ---
let sp = fs.readFileSync('src/lib/statementParser.js', 'utf8');

// Update buildNuTx
sp = sp.replace('function buildNuTx(day, mon, year, concepto, montoStr) {', 'function buildNuTx(day, mon, year, concepto, montoStr, isCreditCard) {');
sp = sp.replace(/tipo:\s*monto\s*<\s*0\s*\?\s*'egreso'\s*:\s*'ingreso',/, "tipo: monto < 0 ? 'egreso' : (isCreditCard ? 'Transferencia' : 'ingreso'),");

// Update parsearNu
sp = sp.replace('function parsearNu(texto) {', 'function parsearNu(texto, isCreditCard) {');
sp = sp.replace(/const tx = buildNuTx\(m\[1\], m\[2\], m\[3\], m\[4\], m\[5\]\);/g, 'const tx = buildNuTx(m[1], m[2], m[3], m[4], m[5], isCreditCard);');

// Update parseMexicanStatement
sp = sp.replace('function parseMexicanStatement(text) {', 'function parseMexicanStatement(text, isCreditCard) {');
sp = sp.replace(/if \(monto > 0\) {/, `if (isCreditCard && tipo === 'ingreso') tipo = 'Transferencia';
        if (monto > 0) {`);

// Update export
sp = sp.replace('export function parseStatementText(rawText) {', 'export function parseStatementText(rawText, isCreditCard = false) {');
sp = sp.replace('const bankResult = parseBankStatement(text);', 'const bankResult = parseBankStatement(text, isCreditCard);');
sp = sp.replace('const nuResult      = parsearNu(text);', 'const nuResult      = parsearNu(text, isCreditCard);');
sp = sp.replace('const genericResult = parseMexicanStatement(text);', 'const genericResult = parseMexicanStatement(text, isCreditCard);');

fs.writeFileSync('src/lib/statementParser.js', sp);

// --- 2. parsers/bank-statement-parser.js ---
let bsp = fs.readFileSync('src/lib/parsers/bank-statement-parser.js', 'utf8');
bsp = bsp.replace('export function parseBankStatement(text) {', 'export function parseBankStatement(text, isCreditCard = false) {');
bsp = bsp.replace('return bbvaParser(text);', 'return bbvaParser(text, isCreditCard);');
bsp = bsp.replace('return santanderParser(text);', 'return santanderParser(text, isCreditCard);');
bsp = bsp.replace('return inbursaParser(text);', 'return inbursaParser(text, isCreditCard);');
bsp = bsp.replace('return banamexParser(text);', 'return banamexParser(text, isCreditCard);');
fs.writeFileSync('src/lib/parsers/bank-statement-parser.js', bsp);

// --- 3. parsers/bbva-parser.js ---
let bbva = fs.readFileSync('src/lib/parsers/bbva-parser.js', 'utf8');
bbva = bbva.replace('export default function parseBBVA(text) {', 'export default function parseBBVA(text, isCreditCard) {');
bbva = bbva.replace(/let tipo = matches\[1\] \? 'egreso' : 'ingreso';/, "let tipo = matches[1] ? 'egreso' : 'ingreso';\n            if (isCreditCard && tipo === 'ingreso') tipo = 'Transferencia';");
fs.writeFileSync('src/lib/parsers/bbva-parser.js', bbva);

// --- 4. parsers/santander-parser.js ---
let sant = fs.readFileSync('src/lib/parsers/santander-parser.js', 'utf8');
sant = sant.replace('export default function parseSantander(text) {', 'export default function parseSantander(text, isCreditCard) {');
sant = sant.replace(/let tipo = isCargo \? 'egreso' : 'ingreso';/, "let tipo = isCargo ? 'egreso' : 'ingreso';\n            if (isCreditCard && tipo === 'ingreso') tipo = 'Transferencia';");
// Fix santander date to YYYY-MM-DD
sant = sant.replace(/function santanderDate\(dateStr\) {[\s\S]*?}/, `function santanderDate(dateStr) {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const mo = MESES[parts[1].toUpperCase()];
    if (!mo) return null;
    const day = parts[0].padStart(2, '0');
    return \`\${parts[2]}-\${mo}-\${day}\`;
}`);
fs.writeFileSync('src/lib/parsers/santander-parser.js', sant);

// --- 5. parsers/inbursa-parser.js ---
let inb = fs.readFileSync('src/lib/parsers/inbursa-parser.js', 'utf8');
inb = inb.replace('export default function parseInbursa(text) {', 'export default function parseInbursa(text, isCreditCard) {');
inb = inb.replace(/let tipo = isEgreso \? 'egreso' : 'ingreso';/, "let tipo = isEgreso ? 'egreso' : 'ingreso';\n            if (isCreditCard && tipo === 'ingreso') tipo = 'Transferencia';");
fs.writeFileSync('src/lib/parsers/inbursa-parser.js', inb);

// --- 6. parsers/banamex-parser.js ---
let ban = fs.readFileSync('src/lib/parsers/banamex-parser.js', 'utf8');
ban = ban.replace('export default function parseBanamex(text) {', 'export default function parseBanamex(text, isCreditCard) {');
ban = ban.replace(/let tipo = isEgreso \? 'egreso' : 'ingreso';/, `let tipo = isEgreso ? 'egreso' : 'ingreso';
            if (isCreditCard && tipo === 'ingreso') tipo = 'Transferencia';
            if (concepto.toLowerCase().includes('pago de tarjeta') || concepto.toLowerCase().includes('transferencia misma cuenta')) {
                tipo = 'Transferencia'; // Excluir
            }`);
fs.writeFileSync('src/lib/parsers/banamex-parser.js', ban);

console.log('Parsers updated');
