"use client";

import { useEffect } from "react";

export function AutoPrint() {
  useEffect(() => {
    // Allow images to load before printing
    const t = setTimeout(() => window.print(), 1200);
    return () => clearTimeout(t);
  }, []);

  return null;
}
