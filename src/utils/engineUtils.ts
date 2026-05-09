export function formatCurrency(amount: number, currency: string = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function parseStatementDate(dateStr: string, format: 'DD/MM/YYYY' | 'MM/DD/YYYY' = 'DD/MM/YYYY'): Date {
  const parts = dateStr.split('/');
  if (parts.length !== 3) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }
  
  let day, month, year;
  if (format === 'DD/MM/YYYY') {
    [day, month, year] = parts;
  } else {
    [month, day, year] = parts;
  }

  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

export function isValidAmount(amount: any): boolean {
  return typeof amount === 'number' && !isNaN(amount) && amount >= 0;
}
