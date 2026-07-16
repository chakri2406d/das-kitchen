"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { formatINR, cn } from "@/lib/utils";
import { upiPayUrl } from "@/lib/upi";

/**
 * Shows a scannable UPI QR plus the UPI ID with a copy button.
 * The QR encodes the exact amount, so the customer can't mistype it.
 */
export function UpiQr({
  upiId,
  payeeName,
  amount,
  note,
  size = 200,
  compact = false,
}: {
  upiId: string;
  payeeName: string;
  amount?: number | null;
  note?: string | null;
  size?: number;
  compact?: boolean;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const payUrl = upiPayUrl({ upiId, payeeName, amount, note });

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(payUrl, {
      width: size * 2, // render at 2x so it stays crisp on phone screens
      margin: 1,
      color: { dark: "#3B2A20", light: "#FFFFFF" }, // brand coffee on white
      errorCorrectionLevel: "M",
    })
      .then((url: string) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [payUrl, size]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (rare) — the ID is on screen to type manually.
    }
  }

  return (
    <div className={cn("flex flex-col items-center", compact ? "gap-2" : "gap-3")}>
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl}
          alt="Scan to pay by UPI"
          className="rounded-xl border border-brown/15 bg-white p-2"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-xl border border-brown/15 bg-white text-xs text-brown/40"
          style={{ width: size, height: size }}
        >
          Generating…
        </div>
      )}

      {amount != null && amount > 0 && (
        <p className="font-display text-lg text-coffee">{formatINR(amount)}</p>
      )}

      <div className="flex items-center gap-2 rounded-full border border-brown/20 bg-white px-3 py-1.5">
        <span className="font-mono text-sm text-coffee">{upiId}</span>
        <button
          type="button"
          onClick={copy}
          className="text-xs font-semibold text-gold-dark hover:underline"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>

      {/* On a phone this opens GPay/PhonePe directly; on desktop it does nothing useful. */}
      <a href={payUrl} className="text-xs font-semibold text-gold-dark hover:underline sm:hidden">
        Open UPI app →
      </a>

      {!compact && (
        <p className="max-w-[16rem] text-center text-xs text-brown/55">
          Scan with any UPI app. Payment is confirmed by the kitchen once received.
        </p>
      )}
    </div>
  );
}
