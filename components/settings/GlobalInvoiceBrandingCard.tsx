"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useUserDb } from "@/components/providers/UserDbProvider";
import { ensureSettingsRow } from "@/lib/settings";
import { processInvoiceLogoFile } from "@/lib/utils/processInvoiceLogo";
import { liveQueryGuard } from "@/lib/dexie/liveQueryGuard";

export function GlobalInvoiceBrandingCard({
  onSaved,
}: {
  onSaved?: () => void;
}) {
  const { db, ready: dbReady } = useUserDb();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [footerDraft, setFooterDraft] = useState("");
  const [savingFooter, setSavingFooter] = useState(false);

  const settingsRow = useLiveQuery(
    async () =>
      liveQueryGuard("settings.branding", async () => {
        if (!dbReady || !db) return undefined;
        await ensureSettingsRow(db);
        return db.settings.get(1);
      }, undefined),
    [dbReady, db]
  );

  useEffect(() => {
    setFooterDraft(settingsRow?.invoiceFooterMessage ?? "");
  }, [settingsRow?.invoiceFooterMessage]);

  const previewUrl = useMemo(() => {
    if (!settingsRow?.invoiceLogoBlob) return null;
    return URL.createObjectURL(settingsRow.invoiceLogoBlob);
  }, [settingsRow?.invoiceLogoBlob]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !db) return;
    setError(null);
    const r = await processInvoiceLogoFile(file);
    if ("error" in r) {
      setError(r.error);
      return;
    }
    await ensureSettingsRow(db);
    const row = await db.settings.get(1);
    if (!row) return;
    await db.settings.put({
      ...row,
      id: 1,
      invoiceLogoBlob: r.blob,
      invoiceLogoMime: r.mime,
    });
    onSaved?.();
  }

  async function removeLogo() {
    if (!db) return;
    setError(null);
    await ensureSettingsRow(db);
    const row = await db.settings.get(1);
    if (!row) return;
    const next = { ...row, id: 1 as const };
    delete next.invoiceLogoBlob;
    delete next.invoiceLogoMime;
    await db.settings.put(next);
    onSaved?.();
  }

  async function saveFooter() {
    if (!db) return;
    setSavingFooter(true);
    setError(null);
    try {
      await ensureSettingsRow(db);
      const row = await db.settings.get(1);
      if (!row) return;
      const trimmed = footerDraft.trim();
      const next = { ...row, id: 1 as const };
      if (trimmed) next.invoiceFooterMessage = trimmed;
      else delete next.invoiceFooterMessage;
      await db.settings.put(next);
      onSaved?.();
    } finally {
      setSavingFooter(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-navy dark:text-slate-100">
        Invoice appearance (this account)
      </h2>
      <p className="mt-1 text-sm text-muted">
        Default logo and thank-you line for printed invoices. Stored on this
        device only — not included in JSON export or cloud backup. You can
        override both for each event in event settings.
      </p>

      {error ? (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-ink dark:text-slate-100">
            Logo
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              aria-hidden
              onChange={(e) => void onPickLogo(e)}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={!dbReady}
              onClick={() => fileRef.current?.click()}
            >
              Upload logo
            </Button>
            {previewUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img
                  src={previewUrl}
                  alt=""
                  className="h-12 max-w-[160px] rounded border border-navy/15 object-contain dark:border-slate-600"
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!dbReady}
                  onClick={() => void removeLogo()}
                >
                  Remove logo
                </Button>
              </>
            ) : (
              <span className="text-sm text-muted">No logo uploaded.</span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted">
            PNG, JPEG, or WebP, up to 600 KB. Shown at the top of invoice PDFs.
          </p>
        </div>

        <div>
          <label
            htmlFor="global-inv-footer"
            className="mb-1 block text-sm font-medium text-ink dark:text-slate-100"
          >
            Default thank-you line
          </label>
          <textarea
            id="global-inv-footer"
            rows={3}
            className="w-full rounded-lg border border-navy/20 bg-white px-3 py-2 text-sm text-ink focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            value={footerDraft}
            onChange={(e) => setFooterDraft(e.target.value)}
            placeholder='Thank you for supporting {org}!'
          />
          <p className="mt-1 text-xs text-muted">
            Use <code className="font-mono text-ink">{"{org}"}</code> for the
            organization name from the current event. Leave empty for the
            built-in default.
          </p>
          <Button
            type="button"
            className="mt-2"
            disabled={!dbReady || savingFooter}
            onClick={() => void saveFooter()}
          >
            {savingFooter ? "Saving…" : "Save thank-you line"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
