"use client";

import { useEffect, useState } from "react";

// The app is dark-first: `:root` is dark and an `html.light` class opts into
// light. So "is the app light" == the class is present; everything else is dark.
// Reacts to the theme toggle live via a class MutationObserver.
export function useAppTheme(): "dark" | "light" {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const read = () =>
      setTheme(document.documentElement.classList.contains("light") ? "light" : "dark");
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  return theme;
}
