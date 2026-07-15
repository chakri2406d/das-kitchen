/** Date ranges for the admin dashboard. Shared by the page and the filter chips. */
export const RANGES = {
  today: { label: "Today", days: 1, noun: "today" },
  "7d": { label: "7 days", days: 7, noun: "in 7 days" },
  "10d": { label: "10 days", days: 10, noun: "in 10 days" },
  "14d": { label: "2 weeks", days: 14, noun: "in 2 weeks" },
  "30d": { label: "30 days", days: 30, noun: "in 30 days" },
} as const;

export type RangeKey = keyof typeof RANGES;
export const DEFAULT_RANGE: RangeKey = "today";

export function isRangeKey(v: string | undefined): v is RangeKey {
  return !!v && v in RANGES;
}
