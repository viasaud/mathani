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

export const placeLabel = (place: string) => (place === "makkah" ? "مكية" : "مدنية");

// "7 آيات", "11 آية": the counted noun agrees with the number
export function ayahs(n: number) {
  if (n === 1) return "آية واحدة";
  if (n === 2) return "آيتان";
  return `${ar(n)} ${n <= 10 ? "آيات" : "آية"}`;
}

// Strip diacritics and unify letter forms so "ابراهيم" finds "إبراهيم".
export const normalize = (s: string) =>
  s
    .replace(/[ً-ٰٟۖ-ۭ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase();

export const westernDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(DIGITS.indexOf(d)));
