import type { MenuItem } from "@/types/database";

export type Variant = { id: string; size: string | null; price: number };
export type MenuGroup = {
  key: string;
  base: string;
  description: string | null;
  food_type: string;
  image_url: string | null;
  is_special: boolean;
  variants: Variant[];
};

// Matches a trailing size in parentheses, e.g. "Baby Corn (Half)".
const SIZE_RE = /^(.+?)\s*\((half|full|large|small|regular|medium|jumbo|mini|quarter)\)\s*$/i;
const SIZE_ORDER = ["mini", "quarter", "small", "half", "regular", "medium", "full", "large", "jumbo"];

export function parseVariant(name: string): { base: string; size: string | null } {
  const m = name.match(SIZE_RE);
  if (!m) return { base: name.trim(), size: null };
  const size = m[2][0].toUpperCase() + m[2].slice(1).toLowerCase();
  return { base: m[1].trim(), size };
}

/** Collapse "X (Half)" and "X (Full)" into one card with selectable variants. */
export function groupMenuItems(items: MenuItem[]): MenuGroup[] {
  const map = new Map<string, MenuGroup>();

  for (const it of items) {
    const { base, size } = parseVariant(it.name);
    const key = base.toLowerCase();
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        base,
        description: it.description,
        food_type: it.food_type,
        image_url: it.image_url,
        is_special: it.is_special,
        variants: [],
      };
      map.set(key, g);
    }
    if (!g.description && it.description) g.description = it.description;
    if (!g.image_url && it.image_url) g.image_url = it.image_url;
    if (it.is_special) g.is_special = true;
    g.variants.push({ id: it.id, size, price: Number(it.price) });
  }

  for (const g of map.values()) {
    g.variants.sort((a, b) => {
      const ai = a.size ? SIZE_ORDER.indexOf(a.size.toLowerCase()) : -1;
      const bi = b.size ? SIZE_ORDER.indexOf(b.size.toLowerCase()) : -1;
      if (ai !== bi) return ai - bi;
      return a.price - b.price;
    });
  }

  return Array.from(map.values());
}
