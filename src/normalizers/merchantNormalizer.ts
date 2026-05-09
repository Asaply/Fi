export function normalizeMerchant(rawDescription: string): string {
  let merchant = rawDescription.toUpperCase();

  // Basic cleaning
  merchant = merchant.replace(/\s+/g, ' ').trim();
  merchant = merchant.replace(/[^A-Z0-9 *.-]/g, '');

  const rules: { pattern: RegExp; replacement: string }[] = [
    { pattern: /UBER\s*\*.*|UBER\s*EATS.*/i, replacement: 'UBER' },
    { pattern: /AMAZON\s*.*/i, replacement: 'AMAZON' },
    { pattern: /OXXO\s*.*/i, replacement: 'OXXO' },
    { pattern: /MERCADO\s*PAGO.*/i, replacement: 'MERCADO PAGO' },
    { pattern: /MERCADO\s*LIBRE.*/i, replacement: 'MERCADO LIBRE' },
    { pattern: /STARBUCKS.*/i, replacement: 'STARBUCKS' },
    { pattern: /NETFLIX.*/i, replacement: 'NETFLIX' },
    { pattern: /SPOTIFY.*/i, replacement: 'SPOTIFY' },
    { pattern: /RAPPI.*/i, replacement: 'RAPPI' },
    { pattern: /DIDI.*/i, replacement: 'DIDI' },
    { pattern: /CINEPOLIS.*/i, replacement: 'CINEPOLIS' },
    { pattern: /WAL\s*MART.*/i, replacement: 'WALMART' },
    { pattern: /PAYPAL.*/i, replacement: 'PAYPAL' },
    { pattern: /APPLE\s*COM.*/i, replacement: 'APPLE' }
  ];

  for (const rule of rules) {
    if (rule.pattern.test(merchant)) {
      return rule.replacement;
    }
  }

  // Fallback cleanup: remove some noise words
  const noiseWords = ['SUC', 'SA DE CV', 'S DE RL', 'MX', 'COMPRA', 'PAGO', 'TARJETA'];
  noiseWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    merchant = merchant.replace(regex, '');
  });

  return merchant.replace(/\s+/g, ' ').trim();
}
