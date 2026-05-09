export type Category = 
  | 'groceries' 
  | 'restaurants' 
  | 'transportation' 
  | 'subscriptions' 
  | 'entertainment' 
  | 'shopping' 
  | 'utilities' 
  | 'health' 
  | 'transfers' 
  | 'fees' 
  | 'interest' 
  | 'investments' 
  | 'salary' 
  | 'cash withdrawal' 
  | 'taxes'
  | 'other';

const categoryMap: Record<string, Category> = {
  'UBER': 'transportation',
  'DIDI': 'transportation',
  'STARBUCKS': 'restaurants',
  'AMAZON': 'shopping',
  'MERCADO LIBRE': 'shopping',
  'OXXO': 'groceries',
  'WALMART': 'groceries',
  'NETFLIX': 'subscriptions',
  'SPOTIFY': 'subscriptions',
  'RAPPI': 'restaurants',
  'CINEPOLIS': 'entertainment',
  'PAYPAL': 'shopping',
  'APPLE': 'subscriptions',
  // Specific credit patterns
  'INTERESES ORDINARIOS': 'interest',
  'COMISION ANUAL': 'fees',
  'PAGO RECIBIDO': 'transfers',
  'SPEI': 'transfers'
};

export function categorizeTransaction(normalizedMerchant: string, rawDescription: string): Category {
  const upperMerchant = normalizedMerchant.toUpperCase();
  
  if (categoryMap[upperMerchant]) {
    return categoryMap[upperMerchant];
  }

  // Heuristics based on raw description for generic matching
  const desc = rawDescription.toUpperCase();
  if (desc.includes('INTERES')) return 'interest';
  if (desc.includes('COMISION') || desc.includes('CUOTA')) return 'fees';
  if (desc.includes('RETIRO') || desc.includes('CAJERO')) return 'cash withdrawal';
  if (desc.includes('TRASPASO') || desc.includes('PAGO DE TARJETA')) return 'transfers';
  if (desc.includes('NOMINA')) return 'salary';

  // Fallback
  return 'other';
}
