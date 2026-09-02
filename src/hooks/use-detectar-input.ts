"use client";

import { useEffect } from "react";

export function useDetectarInput() {
  useEffect(() => {
    const setInputMode = () => {
      if (typeof window === "undefined") return;
      const modo = window.matchMedia("(pointer: coarse)").matches ? "dpad" : "pointer";
      document.documentElement.dataset.input = modo;
    };

    setInputMode();

    const onChange = () => {
      setInputMode();
    };
    window.matchMedia("(pointer: coarse)").addEventListener("change", onChange);

    return () => {
      window.matchMedia("(pointer: coarse)").removeEventListener("change", onChange);
    };
  }, []);
}