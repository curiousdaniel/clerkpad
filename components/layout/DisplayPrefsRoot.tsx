"use client";

import { useEffect, useState } from "react";
import {
  applyDisplayPrefsToDocument,
  readFontScale,
  readHighContrast,
  writeFontScale,
  writeHighContrast,
  type FontScaleKey,
} from "@/lib/displayPrefs";

export function DisplayPrefsRoot() {
  const [fontScale, setFontScale] = useState<FontScaleKey>(() =>
    typeof window !== "undefined" ? readFontScale() : "1"
  );
  const [highContrast, setHighContrast] = useState(() =>
    typeof window !== "undefined" ? readHighContrast() : false
  );

  useEffect(() => {
    applyDisplayPrefsToDocument(fontScale, highContrast);
  }, [fontScale, highContrast]);

  return (
    <div className="border-b border-navy/10 bg-white px-4 py-2 text-xs text-muted">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <span className="font-medium text-navy">Display</span>
        <label className="flex items-center gap-1.5">
          <span className="text-muted">Text</span>
          <select
            className="rounded border border-navy/20 bg-white px-2 py-1 text-sm text-ink"
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
            className="h-4 w-4 rounded border-navy/30"
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
