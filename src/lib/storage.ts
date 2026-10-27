// Per-reader preferences kept in the browser. Every access is guarded: storage can be blocked.
const PREFIX = "mushaf:";

export function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {}
}

export type LastRead = { s: number; a: number; p?: number }; // surah, ayah, and the mushaf page when read there

// Where to pick up again: the mushaf page when it was read there, otherwise the text view.
export const lastReadHref = ({ s, a, p }: LastRead) =>
  p ? `/page/${p}${a > 1 ? `#v${s}-${a}` : ""}` : `/surah/${s}${a > 1 ? `#a${a}` : ""}`;
