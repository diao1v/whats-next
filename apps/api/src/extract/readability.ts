import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";

const THIN_THRESHOLD = 300;

export function extractReadable(html: string, _url: string): { title: string; text: string } {
  const { document } = parseHTML(html);
  let title = "";
  let text = "";
  try {
    const reader = new Readability(document as unknown as Document);
    const article = reader.parse();
    title = article?.title ?? "";
    text = article?.textContent ?? "";
  } catch {
    // Readability can reject some documents; fall through to the DOM fallback.
  }
  if (text.trim().length === 0) {
    const main = document.querySelector("article, main") ?? document.body;
    text = main?.textContent ?? "";
    if (!title) title = document.title ?? "";
  }
  return { title: title.trim(), text: normalize(text) };
}

const normalize = (text: string): string => text.replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*/g, "\n\n").trim();

export const isThin = (text: string): boolean => text.trim().length < THIN_THRESHOLD;
