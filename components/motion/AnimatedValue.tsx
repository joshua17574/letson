"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

type AnimatedValueProps = {
  value: string | number;
  className?: string;
};

const reducedMotionSubscribers = new Set<() => void>();
const currencyFormatters = new Map<number, Intl.NumberFormat>();
let reducedMotionQuery: MediaQueryList | null = null;

function getReducedMotionQuery() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!reducedMotionQuery) {
    reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionQuery.addEventListener("change", () => {
      reducedMotionSubscribers.forEach((subscriber) => subscriber());
    });
  }

  return reducedMotionQuery;
}

function subscribeReducedMotion(callback: () => void) {
  const query = getReducedMotionQuery();

  if (!query) {
    return () => {};
  }

  reducedMotionSubscribers.add(callback);

  return () => {
    reducedMotionSubscribers.delete(callback);
  };
}

function getReducedMotionSnapshot() {
  return getReducedMotionQuery()?.matches ?? false;
}

function getCurrencyFormatter(decimals: number) {
  const existing = currencyFormatters.get(decimals);

  if (existing) {
    return existing;
  }

  const formatter = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  currencyFormatters.set(decimals, formatter);
  return formatter;
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false
  );
}

function parseDisplayValue(value: string | number) {
  const display = String(value);
  const match = display.match(/^(-?)([^0-9-]*)(-?[\d,]+(?:\.\d+)?)(.*)$/);

  if (!match) {
    return null;
  }

  const numericSign = match[1] === "-" ? -1 : 1;
  const numeric = Number(match[3].replace(/,/g, "")) * numericSign;

  if (!Number.isFinite(numeric)) {
    return null;
  }

  const decimals = match[3].includes(".") ? match[3].split(".")[1].length : 0;

  return {
    prefix: match[2],
    numeric,
    suffix: match[4],
    decimals,
    isCurrency: match[2].includes("₱") || match[2].includes("PHP"),
  };
}

function formatDisplayValue(
  prefix: string,
  value: number,
  suffix: string,
  decimals: number,
  isCurrency: boolean
) {
  if (isCurrency) {
    const normalizedValue = Number.isFinite(value) ? value : 0;
    const sign = normalizedValue < 0 ? "-" : "";

    return `${sign}₱${getCurrencyFormatter(decimals).format(Math.abs(normalizedValue))}`;
  }

  return `${prefix}${value.toLocaleString("en-PH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${suffix}`;
}

export function AnimatedValue({ value, className }: AnimatedValueProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const parsed = useMemo(() => parseDisplayValue(value), [value]);
  const [animatedValue, setAnimatedValue] = useState(String(value));

  useEffect(() => {
    const parsedValue = parsed;

    if (!parsedValue || prefersReducedMotion) {
      return;
    }

    const { decimals, isCurrency, numeric, prefix, suffix } = parsedValue;
    let frame = 0;
    const startedAt = performance.now();
    const duration = 650;

    function tick(now: number) {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      const currentValue = numeric * eased;

      setAnimatedValue(
        formatDisplayValue(prefix, currentValue, suffix, decimals, isCurrency)
      );

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setAnimatedValue(String(value));
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [parsed, prefersReducedMotion, value]);

  return (
    <span className={className}>
      {!parsed || prefersReducedMotion ? String(value) : animatedValue}
    </span>
  );
}
