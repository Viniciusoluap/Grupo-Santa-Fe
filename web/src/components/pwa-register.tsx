"use client";

import { useEffect } from "react";
import { initPwa } from "@/lib/pwa";

export function PwaRegister() {
  useEffect(() => {
    initPwa();
  }, []);

  return null;
}
