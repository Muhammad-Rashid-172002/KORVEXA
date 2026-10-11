export const money = (minor: number, currency = 'USD') =>
  new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
