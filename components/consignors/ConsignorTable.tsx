"use client";

import { Pencil, Trash2, FileText } from "lucide-react";
import type { Consignor } from "@/lib/db";
import { Button } from "@/components/ui/Button";

export function ConsignorTable({
  rows,
  defaultCommissionPct,
  onEdit,
  onDelete,
  onStatement,
}: {
  rows: Consignor[];
  defaultCommissionPct: number;
  onEdit: (c: Consignor) => void;
  onDelete: (c: Consignor) => void;
  onStatement: (c: Consignor) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-navy/10 dark:border-slate-700">
      <table className="min-w-full text-sm">
        <thead className="border-b border-navy/10 bg-surface-muted/80 dark:border-slate-700 dark:bg-slate-800/80">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium text-ink dark:text-slate-100">
              #
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium text-ink dark:text-slate-100">
              Name
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium text-ink dark:text-slate-100">
              Commission
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium text-ink dark:text-slate-100">
              Contact
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium text-ink dark:text-slate-100">
              Mailing address
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium text-ink dark:text-slate-100">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-muted">
                No consignors yet.
              </td>
            </tr>
          ) : (
            rows.map((c) => (
              <tr
                key={c.id ?? c.consignorNumber}
                className="border-b border-navy/5 last:border-0 dark:border-slate-800"
              >
                <td className="px-3 py-2 font-mono text-ink dark:text-slate-100">
                  {c.consignorNumber}
                </td>
                <td className="px-3 py-2 text-ink dark:text-slate-100">{c.name}</td>
                <td className="px-3 py-2 text-muted">
                  {typeof c.commissionRate === "number"
                    ? `${(c.commissionRate * 100).toFixed(2).replace(/\.?0+$/, "")}%`
                    : `Default (${defaultCommissionPct.toFixed(2).replace(/\.?0+$/, "")}%)`}
                </td>
                <td className="max-w-[200px] truncate px-3 py-2 text-muted">
                  {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="max-w-[180px] truncate px-3 py-2 text-muted" title={c.mailingAddress}>
                  {c.mailingAddress?.trim() ? c.mailingAddress.trim().split(/\r?\n/)[0] : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2"
                      title="Statement PDF"
                      onClick={() => onStatement(c)}
                    >
                      <FileText className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2"
                      title="Edit"
                      onClick={() => onEdit(c)}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2"
                      title="Delete"
                      onClick={() => onDelete(c)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
