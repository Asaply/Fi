import { BankParser, ParsedStatement, Transaction, StatementMetadata, CreditCardMetrics } from '../types/engine';
import { normalizeMerchant } from '../normalizers/merchantNormalizer';
import { categorizeTransaction } from '../categorization/categoryEngine';

export class BBVAParser implements BankParser {
  parse(text: string): ParsedStatement {
    // This is a stub implementation representing the extraction logic
    // In a real implementation, this would use regex and string matching 
    // to extract fields from the OCR/PDF raw text.
    
    // Example regex for metadata (simplified)
    const cardLast4Match = text.match(/TARJETA DE CREDITO.*(\d{4})/i);
    const last4 = cardLast4Match ? cardLast4Match[1] : '0000';

    const metadata: StatementMetadata = {
      bankName: 'BBVA',
      accountType: 'credit',
      currency: 'MXN',
      accountLast4: last4,
      statementDate: new Date().toISOString().split('T')[0], // Mock
    };

    const metrics: CreditCardMetrics = {
      currentBalance: 15000, // Mock extracted data
      statementBalance: 12000,
      minimumPayment: 1500,
      availableCredit: 35000,
      creditLimit: 50000,
      utilizationPercentage: 30, // 15000 / 50000 * 100
      interestRate: 45, // Mock APR
      annualFee: 0,
      lateFee: 0,
    };

    const transactions: Transaction[] = [];
    
    // Example simulated transaction extraction
    // "12/05/2023 14/05/2023 UBER *TRIP HELP 150.00"
    const txRegex = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})?\s+(.*?)\s+([\d,]+\.\d{2})/g;
    let match;
    
    // Using mock text for demonstration as real parsing requires actual statement text format
    const mockLines = [
      "12/05/2023 14/05/2023 UBER *TRIP HELP 150.00",
      "15/05/2023 OXXO SUC 18291 MTY 45.50",
      "20/05/2023 PAGO RECIBIDO GRACIAS -12000.00"
    ];

    mockLines.forEach((line, index) => {
      const parts = line.split(' ');
      const rawDesc = parts.slice(1, -1).join(' '); // Rough extraction
      const amountStr = parts[parts.length - 1];
      const amount = parseFloat(amountStr.replace(/,/g, ''));
      
      const isPayment = amount < 0 || rawDesc.includes('PAGO RECIBIDO');
      const absAmount = Math.abs(amount);

      const normalizedMerchant = normalizeMerchant(rawDesc);
      const category = categorizeTransaction(normalizedMerchant, rawDesc);

      transactions.push({
        id: `bbva_tx_${index}_${Date.now()}`,
        date: parts[0],
        rawDescription: rawDesc,
        normalizedMerchant,
        amount: absAmount,
        currency: 'MXN',
        type: isPayment ? 'payment' : 'charge',
        category,
      });
    });

    return {
      metadata,
      creditMetrics: metrics,
      transactions,
    };
  }
}
