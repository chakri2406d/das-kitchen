"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { MenuCard } from "@/components/menu/menu-card";
import { cn } from "@/lib/utils";
import type { MenuGroup } from "@/lib/menu";

export type MenuSection = { id: string; name: string; groups: MenuGroup[] };
type Diet = "all" | "veg" | "non_veg";

const DIETS: { key: Diet; label: string; dot?: string }[] = [
  { key: "all", label: "All" },
  { key: "veg", label: "Veg", dot: "bg-green-500" },
  { key: "non_veg", label: "Non-veg", dot: "bg-red-500" },
];

/**
 * Search + diet filter over the whole menu.
 *
 * Filtering happens in the browser on data that's already loaded — so typing is
 * instant, with no server round-trip per keystroke.
 */
export function MenuBrowser({
  sections,
  userId,
  cartQty = {},
}: {
  sections: MenuSection[];
  userId: string | null;
  cartQty?: Record<string, number>;
}) {
  const [q, setQ] = useState("");
  const [diet, setDiet] = useState<Diet>("all");

  const query = q.trim().toLowerCase();
  const filtering = query.length > 0 || diet !== "all";

  const visible = useMemo(() => {
    return sections
      .map((s) => ({
        ...s,
        groups: s.groups.filter((g) => {
          if (diet === "veg" && g.food_type !== "veg") return false;
          if (diet === "non_veg" && g.food_type === "veg") return false; // egg counts as non-veg
          if (!query) return true;
          return (
            g.base.toLowerCase().includes(query) ||
            (g.description ?? "").toLowerCase().includes(query) ||
            s.name.toLowerCase().includes(query) // "soup" finds the whole category
          );
        }),
      }))
      .filter((s) => s.groups.length > 0);
  }, [sections, query, diet]);

  const count = visible.reduce((n, s) => n + s.groups.length, 0);

  return (
    <>
      {/* Search + filter bar */}
      <div className="sticky top-16 z-30 -mx-4 mt-6 bg-cream/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:px-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brown/40" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search biryani, paneer, soup…"
              aria-label="Search the menu"
              className="w-full rounded-full border border-brown/20 bg-white py-2.5 pl-10 pr-9 text-sm outline-none focus:border-gold"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-brown/50 hover:bg-brown/5"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex shrink-0 gap-1 rounded-full bg-white p-1">
            {DIETS.map((d) => (
              <button
                key={d.key}
                onClick={() => setDiet(d.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  diet === d.key ? "bg-coffee text-cream" : "text-brown hover:bg-brown/5"
                )}
              >
                {d.dot && <span className={cn("h-2 w-2 rounded-full", d.dot)} />}
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category jump — only useful when not filtering */}
        {!filtering && sections.length > 1 && (
          <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#cat-${s.id}`}
                className="whitespace-nowrap rounded-full bg-brown/5 px-4 py-1.5 text-sm font-medium text-brown transition-colors hover:bg-gold-soft/60 hover:text-coffee"
              >
                {s.name}
              </a>
            ))}
          </div>
        )}

        {filtering && (
          <p className="mt-2 px-1 text-xs text-brown/60">
            {count} {count === 1 ? "dish" : "dishes"} found
            {query && <> for &ldquo;{q}&rdquo;</>}
          </p>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-brown/20 p-10 text-center">
          <p className="text-brown/70">Nothing matches that.</p>
          <button
            onClick={() => {
              setQ("");
              setDiet("all");
            }}
            className="mt-3 rounded-full bg-gold px-5 py-2 text-sm font-medium text-white hover:bg-gold-dark"
          >
            Clear filters
          </button>
        </div>
      ) : (
        visible.map((s) => (
          <section key={s.id} id={`cat-${s.id}`} className="mt-10 scroll-mt-40">
            <h2 className="font-display text-2xl text-coffee">{s.name}</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 items-start auto-rows-min">
              {s.groups.map((group, i) => (
                <MenuCard key={group.key} group={group} userId={userId} cartQty={cartQty} index={i} />
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}
