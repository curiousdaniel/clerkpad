"use client";

import { useEffect, useState } from "react";
import {
  applyDisplayPrefsToDocument,
  readColorScheme,
  readFontScale,
  readHighContrast,
  writeColorScheme,
  writeFontScale,
  writeHighContrast,
  type ColorSchemePreference,
  type FontScaleKey,
} from "@/lib/displayPrefs";

export function DisplayPrefsRoot() {
  const [fontScale, setFontScale] = useState<FontScaleKey>(() =>
    typeof window !== "undefined" ? readFontScale() : "1"
  );
  const [highContrast, setHighContrast] = useState(() =>
    typeof window !== "undefined" ? readHighContrast() : false
  );
  const [colorScheme, setColorScheme] = useState<ColorSchemePreference>(() =>
    typeof window !== "undefined" ? readColorScheme() : "system"
  );

  useEffect(() => {
    applyDisplayPrefsToDocument(fontScale, highContrast, colorScheme);
  }, [fontScale, highContrast, colorScheme]);

  useEffect(() => {
    if (colorScheme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () =>
      applyDisplayPrefsToDocument(fontScale, highContrast, "system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [colorScheme, fontScale, highContrast]);

  return (
    <div className="border-b border-navy/10 bg-white px-4 py-2 text-xs text-muted dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <span className="font-medium text-navy dark:text-slate-200">
          Display
        </span>
        <label className="flex items-center gap-1.5">
          <span className="text-muted dark:text-slate-500">Appearance</span>
          <select
            className="rounded border border-navy/20 bg-white px-2 py-1 text-sm text-ink dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            value={colorScheme}
            onChange={(e) => {
              const v = e.target.value as ColorSchemePreference;
              writeColorScheme(v);
              setColorScheme(v);
            }}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-muted dark:text-slate-500">Text</span>
          <select
            className="rounded border border-navy/20 bg-white px-2 py-1 text-sm text-ink dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            value={fontScale}
            onChange={(e) => {
              const v = e.target.value as FontScaleKey;
              writeFontScale(v);
              setFontScale(v);
            }}
          >
            <option value="1">Default</option>
            <option value="1.15">Large</option>
            <option value="1.3">Larger</option>
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-navy/30 dark:border-slate-500"
            checked={highContrast}
            onChange={(e) => {
              const on = e.target.checked;
              writeHighContrast(on);
              setHighContrast(on);
            }}
          />
          High contrast
        </label>
      </div>
    </div>
  );
}
