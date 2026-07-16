/**
 * UPI deep links.
 *
 * A UPI QR is nothing more than this URL encoded as a QR image. Scanning it
 * opens the customer's UPI app (GPay/PhonePe/Paytm) with your ID, the payee
 * name and the exact amount pre-filled — so they can't mistype it.
 *
 * IMPORTANT: this does NOT confirm payment. There is no callback. Money moves
 * bank-to-bank and the website never hears about it, which is why a human has
 * to confirm. That's the trade-off for paying no gateway fees and needing no KYC.
 */
export function upiPayUrl(opts: {
  upiId: string;
  payeeName: string;
  amount?: number | null;
  note?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set("pa", opts.upiId.trim()); // payee address
  params.set("pn", (opts.payeeName || "Das Kitchen").trim()); // payee name
  params.set("cu", "INR");
  if (opts.amount != null && opts.amount > 0) params.set("am", opts.amount.toFixed(2));
  if (opts.note) params.set("tn", opts.note.slice(0, 50)); // transaction note
  return `upi://pay?${params.toString()}`;
}

/** Very light sanity check — catches typos like a missing @ or stray spaces. */
export function looksLikeUpiId(v: string | null | undefined): boolean {
  if (!v) return false;
  return /^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/.test(v.trim());
}
