'use client';

import { useHotel } from './use-hotel';

export function useCurrencySymbol(): string {
  const { data: hotel } = useHotel();
  return hotel?.currencySymbol || '$';
}

export function formatPrice(amount: number | string, symbol: string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return `${symbol}0.00`;
  return `${symbol}${num.toFixed(2)}`;
}
