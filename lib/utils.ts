// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const pesoAmountFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPeso(value: number) {
  const amount = Number(value);
  const normalizedAmount = Number.isFinite(amount) ? amount : 0;
  const sign = normalizedAmount < 0 ? "-" : "";

  return `${sign}₱${pesoAmountFormatter.format(Math.abs(normalizedAmount))}`;
}
