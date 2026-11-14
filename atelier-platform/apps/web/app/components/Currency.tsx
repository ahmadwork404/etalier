"use client";
import { createContext, useContext } from "react";
export const CurrencyContext = createContext("USD");
export function getCurrencySymbol(currency: string) {
  return (
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value || "$"
  );
}
export function useCurrencySymbol() {
  return getCurrencySymbol(useCurrency());
}
export function useCurrency() {
  return useContext(CurrencyContext);
}
export function useMoney() {
  const currency = useCurrency();
  return (value: unknown) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).format(Number(value || 0) / 100);
}
