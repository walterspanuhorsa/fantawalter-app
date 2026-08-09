"use client";

import { useEffect } from "react";

const THEME_STORAGE_KEY = "fantawalter-theme-v1";

export default function ThemeInitializer() {
  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem(
        THEME_STORAGE_KEY,
      );
      const theme = savedTheme === "dark" ? "dark" : "light";

      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch {
      document.documentElement.dataset.theme = "light";
      document.documentElement.style.colorScheme = "light";
    }
  }, []);

  return null;
}
