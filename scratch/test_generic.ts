import fs from 'fs';
import { parseStatementText } from '../src/lib/statementParser.js';

const text = fs.readFileSync('scratch/nu_v2_text.txt', 'utf8');
const tx = parseStatementText(text, false);
console.log(`Found ${tx.length} transactions.`);
if (tx.length > 0) {
    console.log(tx.slice(0, 3));
}
