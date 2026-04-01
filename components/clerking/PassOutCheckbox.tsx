"use client";

export function PassOutCheckbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-medium text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-navy/30 text-navy focus:ring-navy"
      />
      <span>Pass out lots</span>
      <span className="text-xs font-normal text-muted">
        Shift+Enter enables pass-out and clerks · Esc exits pass-out and clears
      </span>
    </label>
  );
}
