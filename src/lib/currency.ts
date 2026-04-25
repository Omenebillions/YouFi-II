export const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'US Dollar (USD)' },
  { code: 'EUR', symbol: '€', label: 'Euro (EUR)' },
  { code: 'GBP', symbol: '£', label: 'British Pound (GBP)' },
  { code: 'NGN', symbol: '₦', label: 'Nigerian Naira (NGN)' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee (INR)' },
];

export const formatCurrency = (amount: number, currencyCode: string = 'USD') => {
  return new Intl.NumberFormat(undefined, { 
    style: 'currency', 
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2 
  }).format(amount);
};
