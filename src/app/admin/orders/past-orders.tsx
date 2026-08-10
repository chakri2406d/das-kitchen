"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { OrderCard, type AdminOrder, type Rider } from "./order-card";
import { deleteOrders } from "./actions";

export type PastOrderCard = {
  order: AdminOrder;
  riders: Rider[];
  distanceKm: number | null;
  radiusKm: number | null;
  kitchenLat: number | null;
  kitchenLng: number | null;
};

/**
 * "Completed & cancelled" history with an always-on checkbox column so the
 * admin can permanently remove unwanted orders. Deletion is double-gated: a
 * confirmation showing how many orders, then an admin password verified
 * server-side in `deleteOrders`. The card itself stays fully interactive.
 */
export function PastOrders({ items }: { items: PastOrderCard[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const allIds = useMemo(() => items.map((it) => it.order.id), [items]);
  const count = selected.size;
  const allSelected = count > 0 && count === allIds.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  function closeModal() {
    setConfirmOpen(false);
    setPassword("");
    setError(null);
  }

  function submitDelete() {
    setError(null);
    const ids = [...selected];
    startTransition(async () => {
      const res = await deleteOrders(ids, password);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSelected(new Set());
      closeModal();
      router.refresh();
    });
  }

  return (
    <div className="mt-4">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={toggleAll}
          className="rounded-full border border-brown/25 px-4 py-1.5 text-sm font-medium text-brown transition hover:bg-brown/5"
        >
          {allSelected ? "Clear all" : "Select all"}
        </button>

        <button
          onClick={() => setConfirmOpen(true)}
          disabled={count === 0}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
            count === 0
              ? "cursor-not-allowed bg-brown/10 text-brown/40"
              : "bg-red-600 text-white shadow-sm hover:bg-red-700"
          }`}
        >
          Delete selected
        </button>

        {count > 0 && <span className="text-sm font-medium text-brown/60">{count} selected</span>}
      </div>

      {/* Checkbox lives in its own column so it never overlaps the card content */}
      <div className="space-y-4">
        {items.map((it) => {
          const isSel = selected.has(it.order.id);
          return (
            <div key={it.order.id} className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={isSel}
                onChange={() => toggle(it.order.id)}
                aria-label={`Select order ${it.order.order_number ?? ""}`}
                className="mt-5 h-5 w-5 shrink-0 cursor-pointer rounded border-brown/30 accent-red-600"
              />
              <div
                className={`flex-1 rounded-2xl transition ${
                  isSel ? "ring-2 ring-red-500 ring-offset-2 ring-offset-cream" : ""
                }`}
              >
                <OrderCard {...it} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation + password modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-red-700">
              Delete {count} order{count === 1 ? "" : "s"}?
            </h3>
            <p className="mt-2 text-sm text-brown/70">
              This permanently removes {count === 1 ? "this order" : `these ${count} orders`} — including their items and
              delivery records — from the database and the website. This cannot be undone.
            </p>

            <label className="mt-4 block text-sm font-medium text-brown">
              Enter admin password to confirm
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && password && !pending && submitDelete()}
                className="mt-1 w-full rounded-xl border border-brown/25 bg-white px-3 py-2 text-sm outline-none focus:border-red-500"
                placeholder="Password"
              />
            </label>

            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={closeModal}
                disabled={pending}
                className="rounded-full px-4 py-2 text-sm font-medium text-brown/70 transition hover:text-brown"
              >
                Cancel
              </button>
              <button
                onClick={submitDelete}
                disabled={pending || !password}
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Deleting…" : `Delete ${count} order${count === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
