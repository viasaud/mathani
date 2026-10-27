// Interactions in the text views: verse sheet, copy, the header's page/juz, last-read memory.
import { ar, JUZ_NAMES } from "../lib/arabic";
import { closeSheet, initSheet, openSheet, sheetOpen } from "../lib/sheet";
import { save } from "../lib/storage";
import { $, copyVerse, copyVerseLink, flash, isTyping } from "../lib/ui";

const reader = $("reader");
const surah = Number(reader.dataset.surah);
const name = reader.dataset.name!;
const text = $("surah-text");
const header = $("hd");
const listView = text.querySelector<HTMLElement>(".list-view")!;
const count = listView.querySelectorAll(".v").length;
const currentView = () => text.querySelector<HTMLElement>(document.documentElement.dataset.mode === "list" ? ".list-view" : ".flow-view")!;
const verseIn = (view: HTMLElement, i: number) => view.querySelector<HTMLElement>(`[data-i="${i}"]`);
const remember = (i: number) => save("last", { s: surah, a: i + 1, p: Number(verseIn(listView, i)?.dataset.p) || undefined });

let topIndex = 0;

function goAyah(n: number) {
  const el = verseIn(currentView(), n - 1);
  if (!el) return;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - header.offsetHeight - 24 });
}

// ---------- verse sheet (from the continuous text) ----------
initSheet();
function show(i: number) {
  const section = verseIn(listView, i)!;
  const tafsir = document.getElementById(`t${section.dataset.g}`);
  openSheet(
    {
      s: surah, a: i + 1, surahName: name, sub: `صفحة ${ar(section.dataset.p!)}`,
      verse: { html: section.querySelector(".v-text")!.innerHTML },
      plain: section.querySelector(".t")!.textContent!,
      label: tafsir?.querySelector("b")?.textContent ?? "التفسير الميسّر",
      tafsir: tafsir?.querySelector("p")?.textContent ?? "",
      marks: [verseIn(currentView(), i)!],
    },
    { prev: i > 0 ? () => show(i - 1) : undefined, next: i < count - 1 ? () => show(i + 1) : undefined },
  );
  remember(i);
}

text.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  const copy = target.closest<HTMLElement>(".copy");
  if (copy) {
    const i = Number(copy.dataset.i);
    return copyVerse(verseIn(listView, i)!.querySelector(".t")!.textContent!, name, i + 1);
  }
  const link = target.closest<HTMLElement>(".link");
  if (link) return copyVerseLink(surah, Number(link.dataset.i) + 1);
  const ayah = target.closest<HTMLElement>(".ayah");
  if (ayah) show(Number(ayah.dataset.i));
});
text.addEventListener("keydown", (e) => {
  const ayah = (e.target as HTMLElement).closest<HTMLElement>(".ayah");
  if (ayah && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    show(Number(ayah.dataset.i));
  }
});

// ---------- the header follows the page and juz being read ----------
const meta = document.getElementById("ctx-meta");
const baseMeta = meta?.innerHTML ?? "";
let ticking = false;
let saveTimer = 0;
const bar = $("progress");
function track() {
  ticking = false;
  const rect = text.getBoundingClientRect();
  const end = rect.bottom + scrollY - innerHeight;
  bar.style.setProperty("--p", String(Math.min(1, Math.max(0, scrollY / Math.max(end, 1)))));
  const el = document
    .elementsFromPoint(rect.left + rect.width / 2, Math.max(header.getBoundingClientRect().bottom, 0) + 40)
    .find((e): e is HTMLElement => e instanceof HTMLElement && !!e.dataset.p);
  if (!el) {
    if (meta && scrollY < 200) meta.innerHTML = baseMeta;
    return;
  }
  topIndex = Number(el.dataset.i);
  if (meta) meta.innerHTML = `<span>صفحة ${ar(el.dataset.p!)}</span><span>الجزء ${JUZ_NAMES[Number(el.dataset.j)]}</span><span>الحزب ${ar(Math.ceil(Number(el.dataset.r) / 4))}</span>`;
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => sheetOpen() || remember(topIndex), 400);
}
window.addEventListener("scroll", () => {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(track);
  }
}, { passive: true });

// ---------- switching views keeps the same verse in view ----------
let keep = 0;
window.addEventListener("mushaf:beforemode", () => {
  keep = topIndex;
  closeSheet();
});
window.addEventListener("mushaf:mode", () => {
  if (document.documentElement.dataset.mode === "pages") {
    const page = verseIn(listView, keep)!.dataset.p;
    location.href = `/page/${page}${keep > 0 ? `#v${surah}-${keep + 1}` : ""}`;
    return;
  }
  if (keep > 0) goAyah(keep + 1);
  else window.scrollTo({ top: 0 });
});

// ---------- keyboard: arrows move between surahs (RTL: left is next) ----------
document.addEventListener("keydown", (e) => {
  if (isTyping(e) || document.querySelector("dialog[open]") || sheetOpen()) return;
  if (e.key === "ArrowLeft") document.getElementById("next")?.click();
  if (e.key === "ArrowRight") document.getElementById("prev")?.click();
});

// ---------- #a12 opens at verse 12 ----------
function fromHash() {
  const m = /^#a(\d{1,3})$/.exec(location.hash);
  if (!m) return;
  goAyah(Number(m[1]));
  const el = verseIn(currentView(), Number(m[1]) - 1);
  if (el) flash([el.matches(".v") ? el.querySelector(".v-text")! : el]);
  remember(Number(m[1]) - 1);
}
window.addEventListener("hashchange", fromHash);
requestAnimationFrame(() => {
  fromHash();
  track();
});
if (!/^#a\d/.test(location.hash)) remember(0);
