// Arabic-aware matching for verse search: ignores diacritics, tatweel and hamza/alef/ta-marbuta forms,
// and keeps a map back to the original text so matches can be highlighted in place.

const IGNORED = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/;
const FOLD: Record<string, string> = { "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ة": "ه", "ى": "ي", "ؤ": "و", "ئ": "ي" };

export type Folded = { text: string; map: number[] };
export type VerseEntry = { s: number; a: number; text: string; folded: Folded };

// Every verse, folded for matching (/search.json), fetched once per visit; a failed fetch is tried again next time.
let cached: Promise<VerseEntry[]> | undefined;
export function verseIndex() {
  cached ??= fetch("/search.json")
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    })
    .then((rows: [number, number, string][]) => rows.map(([s, a, text]) => ({ s, a, text, folded: fold(text) })));
  cached.catch(() => (cached = undefined));
  return cached;
}

export function fold(s: string): Folded {
  let text = "";
  const map: number[] = [];
  let space = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (IGNORED.test(ch)) continue;
    if (/\s/.test(ch)) {
      if (space || !text) continue;
      space = true;
      text += " ";
    } else {
      space = false;
      text += FOLD[ch] ?? ch;
    }
    map.push(i);
  }
  if (text.endsWith(" ")) {
    text = text.slice(0, -1);
    map.pop();
  }
  return { text, map };
}

// Original-text ranges of every match, each extended over the diacritics that follow its last letter.
export function matchRanges(original: string, folded: Folded, query: string): [number, number][] {
  const ranges: [number, number][] = [];
  for (let at = folded.text.indexOf(query); at !== -1; at = folded.text.indexOf(query, at + query.length)) {
    const start = folded.map[at];
    let end = folded.map[at + query.length - 1] + 1;
    while (end < original.length && IGNORED.test(original[end])) end++;
    ranges.push([start, end]);
  }
  return ranges;
}
