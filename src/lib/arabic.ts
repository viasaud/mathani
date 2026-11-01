const DIGITS = "٠١٢٣٤٥٦٧٨٩";

export const ar = (n: number | string) => String(n).replace(/\d/g, (d) => DIGITS[+d]);

export const BISMILLAH = "بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ";

export const JUZ_NAMES = [
  "", "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر",
  "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر", "السادس عشر", "السابع عشر",
  "الثامن عشر", "التاسع عشر", "العشرون", "الحادي والعشرون", "الثاني والعشرون", "الثالث والعشرون",
  "الرابع والعشرون", "الخامس والعشرون", "السادس والعشرون", "السابع والعشرون", "الثامن والعشرون",
  "التاسع والعشرون", "الثلاثون",
];
// after a preposition: «في الجزء الثلاثين», «عن الجزء الحادي والعشرين»
export const juzGenitive = (j: number) => JUZ_NAMES[j].replace(/ون(?=\s|$)/g, "ين");

// The names people search for a juz by, where one is in common use: its opening words.
export const JUZ_COMMON: Record<number, string> = { 28: "جزء قد سمع", 29: "جزء تبارك", 30: "جزء عم" };

// Verses known by a name of their own: a single verse, or a group read together (from–to).
export const VERSE_NAMES = [
  { s: 2, from: 255, to: 255, name: "آية الكرسي" },
  { s: 2, from: 282, to: 282, name: "آية الدين" },
  { s: 2, from: 285, to: 286, name: "خواتيم سورة البقرة" },
  { s: 3, from: 190, to: 200, name: "خواتيم سورة آل عمران" },
  { s: 4, from: 176, to: 176, name: "آية الكلالة" },
  { s: 18, from: 1, to: 10, name: "العشر الأوائل من سورة الكهف" },
  { s: 24, from: 35, to: 35, name: "آية النور" },
  { s: 59, from: 22, to: 24, name: "خواتيم سورة الحشر" },
];
export const verseName = (s: number, a: number) => VERSE_NAMES.find((v) => v.s === s && a >= v.from && a <= v.to)?.name;

export const placeLabel = (place: string) => (place === "makkah" ? "مكية" : "مدنية");

// "7 آيات", "11 آية": the counted noun agrees with the number
export function ayahs(n: number) {
  if (n === 1) return "آية واحدة";
  if (n === 2) return "آيتان";
  return `${ar(n)} ${n <= 10 ? "آيات" : "آية"}`;
}

// the four quarters of a hizb, each named from where it begins: «ربع الحزب ٣»
export const QUARTERS = ["الحزب", "ربع الحزب", "نصف الحزب", "ثلاثة أرباع الحزب"];

// "٧ سور", "١١ سورة": the counted noun agrees with the number
export const surahCount = (n: number) =>
  n === 0 ? "لا توجد سور" : n === 1 ? "سورة واحدة" : n === 2 ? "سورتان" : `${ar(n)} ${n <= 10 ? "سور" : "سورة"}`;

// Strip diacritics and unify letter forms so "ابراهيم" finds "إبراهيم" (the same folding as src/lib/search.ts).
export const normalize = (s: string) =>
  s
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .toLowerCase();

export const westernDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(DIGITS.indexOf(d)));
