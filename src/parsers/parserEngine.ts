import { BankType, BankParser, ParsedStatement } from '../types/engine';
import { detectBank } from '../core/bankDetection';

export class ParserEngine {
  private parsers: Map<BankType, BankParser> = new Map();

  registerParser(bank: BankType, parser: BankParser) {
    this.parsers.set(bank, parser);
  }

  parse(rawText: string): ParsedStatement {
    const bankType = detectBank(rawText);
    
    if (bankType === 'UNKNOWN') {
      throw new Error('Unsupported or unknown bank format.');
    }

    const parser = this.parsers.get(bankType);
    if (!parser) {
      throw new Error(`Parser for bank ${bankType} is not registered.`);
    }

    return parser.parse(rawText);
  }
}
