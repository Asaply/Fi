import { BankType } from '../types/engine';

export function detectBank(rawText: string): BankType {
  const upperText = rawText.toUpperCase();

  // Keyword and signature matching
  if (upperText.includes('BBVA BANCOMER') || upperText.includes('BBVA MEXICO') || upperText.includes('WWW.BBVA.MX')) {
    return 'BBVA';
  }
  
  if (upperText.includes('BANAMEX') || upperText.includes('TARJETA DE CREDITO BANAMEX') || upperText.includes('CITIBANAMEX')) {
    return 'BANAMEX';
  }

  if (upperText.includes('SANTANDER') || upperText.includes('BANCO SANTANDER') || upperText.includes('SANTANDER CONSUMO')) {
    return 'SANTANDER';
  }

  if (upperText.includes('AMERICAN EXPRESS') || upperText.includes('AMEX')) {
    return 'AMEX';
  }

  return 'UNKNOWN';
}
