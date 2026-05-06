import fs from 'fs';
import { PDFParse } from 'pdf-parse';

(async () => {
    const buffer = fs.readFileSync('Estados de cuenta statement/Nu debito.pdf');
    const parser = new PDFParse({ data: new Uint8Array(buffer), verbosity: 0 });
    const data = await parser.getText();
    console.log(data.text);
})();
