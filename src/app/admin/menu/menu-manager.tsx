"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { formatINR, cn } from "@/lib/utils";
import type { Category, FoodType, MenuItem } from "@/types/database";
import { compressImage, formatBytes } from "@/lib/image";
import {
  saveMenuItem,
  deleteMenuItem,
  toggleAvailable,
  toggleSpecial,
  createCategory,
  toggleCategoryActive,
} from "./actions";

const FOOD_TYPES: FoodType[] = ["veg", "non_veg", "egg"];
const STORAGE_BUCKET = "menu";

type Draft = {
  id?: string;
  name: string;
  description: string;
  price: string;
  category_id: string;
  food_type: FoodType;
  is_available: boolean;
  is_special: boolean;
  prep_time_minutes: string;
  daily_quantity_limit: string;
  image_url: string;
};

function emptyDraft(categoryId: string): Draft {
  return {
    name: "",
    description: "",
    price: "",
    category_id: categoryId,
    food_type: "veg",
    is_available: true,
    is_special: false,
    prep_time_minutes: "20",
    daily_quantity_limit: "",
    image_url: "",
  };
}

function toDraft(item: MenuItem): Draft {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? "",
    price: String(item.price),
    category_id: item.category_id ?? "",
    food_type: item.food_type,
    is_available: item.is_available,
    is_special: item.is_special,
    prep_time_minutes: String(item.prep_time_minutes ?? 20),
    daily_quantity_limit: item.daily_quantity_limit == null ? "" : String(item.daily_quantity_limit),
    image_url: item.image_url ?? "",
  };
}

export function MenuManager({ categories, items }: { categories: Category[]; items: MenuItem[] }) {
  const supabase = createClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imgNote, setImgNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setMsg(res.error ?? "Something went wrong.");
      else if (okMsg) setMsg(okMsg);
    });
  }

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  }

  async function uploadImage(file: File) {
    setMsg(null);
    setImgNote(null);
    setUploading(true);

    let payload: Blob = file;
    let ext = file.name.split(".").pop() ?? "jpg";
    let contentType = file.type || "image/jpeg";

    try {
      // Shrink first — a raw phone photo would eat your bandwidth alive.
      const out = await compressImage(file, { maxWidth: 1200, maxBytes: 200 * 1024 });
      payload = out.blob;
      ext = out.ext;
      contentType = out.type;
      setImgNote(
        `Optimised: ${formatBytes(out.beforeBytes)} → ${formatBytes(out.afterBytes)} (${out.width}px wide)`
      );
    } catch {
      // Compression failed (odd format?) — upload the original rather than block.
      setImgNote("Couldn't optimise this one — uploading the original.");
    }

    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, payload, { upsert: true, contentType, cacheControl: "31536000" });

    if (error) {
      setUploading(false);
      setMsg(`Image upload failed: ${error.message}. Create a public Storage bucket named "${STORAGE_BUCKET}".`);
      return;
    }
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    set("image_url", data.publicUrl);
    setUploading(false);
  }

  function save() {
    if (!draft) return;
    run(
      () =>
        saveMenuItem({
          id: draft.id,
          name: draft.name,
          description: draft.description,
          price: Number(draft.price) || 0,
          category_id: draft.category_id || null,
          food_type: draft.food_type,
          is_available: draft.is_available,
          is_special: draft.is_special,
          prep_time_minutes: Number(draft.prep_time_minutes) || 20,
          daily_quantity_limit: draft.daily_quantity_limit ? Number(draft.daily_quantity_limit) : null,
          image_url: draft.image_url || null,
        }),
      "Saved."
    );
    setDraft(null);
  }

  const field = "w-full rounded-xl border border-brown/20 bg-white px-3 py-2 text-sm outline-none focus:border-gold";
  const activeCats = categories;

  return (
    <div className="space-y-8">
      {msg && <p className="rounded-xl border border-brown/15 bg-soft px-4 py-2.5 text-sm text-brown/80">{msg}</p>}

      {/* Categories */}
      <section className="rounded-2xl border border-brown/10 bg-soft p-6 shadow-card">
        <h2 className="font-display text-xl text-coffee">Categories</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => run(() => toggleCategoryActive(c.id, !c.is_active))}
              disabled={pending}
              title="Click to show/hide"
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
                c.is_active ? "bg-gold-soft/60 text-coffee" : "bg-cream text-brown/50 line-through"
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="New category name"
            className={cn(field, "max-w-xs")}
          />
          <button
            onClick={() => {
              if (!newCategory.trim()) return;
              run(() => createCategory(newCategory), "Category added.");
              setNewCategory("");
            }}
            disabled={pending}
            className="rounded-full bg-coffee px-4 py-2 text-sm font-medium text-cream hover:bg-brown disabled:opacity-60"
          >
            Add
          </button>
        </div>
      </section>

      {/* Add dish */}
      <div>
        <button
          onClick={() => setDraft(emptyDraft(activeCats[0]?.id ?? ""))}
          className="rounded-full bg-gold px-6 py-2.5 text-sm font-semibold text-white shadow-warm hover:bg-gold-dark"
        >
          + Add new dish
        </button>
      </div>

      {/* Editor */}
      {draft && (
        <section className="rounded-2xl border border-gold/40 bg-white p-6 shadow-warm">
          <h2 className="font-display text-xl text-coffee">{draft.id ? "Edit dish" : "New dish"}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-brown">Name</label>
              <input className={field} value={draft.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-brown">Description</label>
              <textarea className={field} rows={2} value={draft.description} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-brown">Price (₹)</label>
              <input className={field} inputMode="decimal" value={draft.price} onChange={(e) => set("price", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-brown">Category</label>
              <select className={field} value={draft.category_id} onChange={(e) => set("category_id", e.target.value)}>
                <option value="">Uncategorised</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-brown">Food type</label>
              <select className={field} value={draft.food_type} onChange={(e) => set("food_type", e.target.value as FoodType)}>
                {FOOD_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace("_", "-")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-brown">Prep time (min)</label>
              <input className={field} inputMode="numeric" value={draft.prep_time_minutes} onChange={(e) => set("prep_time_minutes", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-brown">Daily limit (blank = unlimited)</label>
              <input className={field} inputMode="numeric" value={draft.daily_quantity_limit} onChange={(e) => set("daily_quantity_limit", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-brown">Image</label>
              <div className="flex items-center gap-3">
                {draft.image_url && (
                  <Image src={draft.image_url} alt="" width={48} height={48} className="h-12 w-12 rounded-lg object-cover" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])}
                  className="text-sm text-brown/70"
                />
                {uploading && <span className="text-sm text-brown/60">Optimising…</span>}
              </div>
              {imgNote && <p className="mt-1.5 text-xs text-green-700">{imgNote}</p>}
              <p className="mt-1 text-xs text-brown/50">
                Photos are shrunk automatically — upload straight from your phone, no editing needed.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-brown">
              <input type="checkbox" checked={draft.is_available} onChange={(e) => set("is_available", e.target.checked)} className="h-4 w-4 accent-gold" />
              Available
            </label>
            <label className="flex items-center gap-2 text-sm text-brown">
              <input type="checkbox" checked={draft.is_special} onChange={(e) => set("is_special", e.target.checked)} className="h-4 w-4 accent-gold" />
              Today&apos;s Special
            </label>
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={save} disabled={pending || uploading} className="rounded-full bg-gold px-6 py-2 text-sm font-semibold text-white hover:bg-gold-dark disabled:opacity-60">
              {pending ? "Saving…" : "Save dish"}
            </button>
            <button onClick={() => setDraft(null)} className="rounded-full border border-brown/25 px-6 py-2 text-sm font-medium text-brown hover:bg-brown/5">
              Cancel
            </button>
          </div>
        </section>
      )}

      {/* Items list */}
      <section>
        <h2 className="font-display text-xl text-coffee">All dishes ({items.length})</h2>
        {items.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-brown/20 p-8 text-center text-brown/60">
            No dishes yet. Add your first one above.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <article key={item.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-brown/10 bg-soft p-4 shadow-card">
                {item.image_url ? (
                  <Image src={item.image_url} alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-cream text-xs text-brown/40">No img</div>
                )}
                <div className="min-w-[8rem] flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 rounded-full", item.food_type === "veg" ? "bg-green-500" : item.food_type === "egg" ? "bg-amber-500" : "bg-red-500")} />
                    <p className="font-medium text-coffee">{item.name}</p>
                    {item.is_special && <span className="rounded-full bg-gold-soft/70 px-2 py-0.5 text-[11px] font-semibold text-coffee">Special</span>}
                  </div>
                  <p className="text-sm text-brown/60">{formatINR(item.price)}</p>
                </div>

                <button
                  onClick={() => run(() => toggleAvailable(item.id, !item.is_available))}
                  disabled={pending}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60",
                    item.is_available ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-red-100 text-red-800 hover:bg-red-200"
                  )}
                >
                  {item.is_available ? "Available" : "Unavailable"}
                </button>
                <button
                  onClick={() => run(() => toggleSpecial(item.id, !item.is_special))}
                  disabled={pending}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60",
                    item.is_special ? "bg-gold text-white hover:bg-gold-dark" : "bg-cream text-brown hover:bg-brown/10"
                  )}
                >
                  {item.is_special ? "★ Special" : "Mark special"}
                </button>
                <button onClick={() => setDraft(toDraft(item))} className="rounded-full border border-brown/25 px-3 py-1.5 text-xs font-medium text-brown hover:bg-brown/5">
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${item.name}"?`)) run(() => deleteMenuItem(item.id), "Deleted.");
                  }}
                  disabled={pending}
                  className="rounded-full px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  Delete
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
