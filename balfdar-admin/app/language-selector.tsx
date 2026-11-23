"use client";
import { useEffect, useRef, useState } from "react";
import { Languages } from "lucide-react";
import { copy, translateText, type Language } from "./languages";

const KEY = "akker-language";
const languages: { id: Language; label: string }[] = [
  { id: "en", label: "English · EN" },
  { id: "fr", label: "Français · FR" },
  { id: "ar", label: "العربية · AR" },
];

function sourceText(value: string): string {
  for (const language of ["en", "ar"] as const) {
    for (const [source, translated] of Object.entries(copy[language])) {
      if (value.trim() === translated) return value.replace(value.trim(), source);
    }
  }
  return value;
}

function applyLanguage(language: Language) {
  const root = document.documentElement;
  root.lang = language;
  root.dir = language === "ar" ? "rtl" : "ltr";
  root.dataset.language = language;
  document.body.dir = root.dir;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if ((node.parentElement)?.closest("[data-no-translate],input,textarea,select,[contenteditable='true']")) continue;
    const text = node.textContent ?? "";
    const source = sourceText(text);
    const translated = translateText(source, language);
    if (translated !== text) node.textContent = translated;
  }
  const attrs = ["placeholder", "aria-label", "title"];
  document.querySelectorAll<HTMLElement>("body *").forEach(element => {
    if (element.closest("[data-no-translate]")) return;
    attrs.forEach(attribute => {
      const value = element.getAttribute(attribute);
      if (value) { const translated = translateText(sourceText(value), language); if (translated !== value) element.setAttribute(attribute, translated); }
    });
  });
}

export default function LanguageSelector() {
  const [language, setLanguage] = useState<Language>("en");
  const initialRef = useRef<Language>("en");
  useEffect(() => {
    let initial: Language = "en";
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "en" || saved === "fr" || saved === "ar") initial = saved;
      else if (navigator.language.toLowerCase().startsWith("ar")) initial = "ar";
      else if (navigator.language.toLowerCase().startsWith("fr")) initial = "fr";
    } catch { /* Keep English as the default when storage is unavailable. */ }
    initialRef.current = initial; setLanguage(initial);
    applyLanguage(initial);
    const observer = new MutationObserver(() => applyLanguage(initialRef.current));
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "aria-label", "title"] });
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY && (event.newValue === "en" || event.newValue === "fr" || event.newValue === "ar")) {
        initialRef.current = event.newValue; setLanguage(event.newValue); applyLanguage(event.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => { observer.disconnect(); window.removeEventListener("storage", onStorage); };
  }, []);
  function choose(next: Language) {
    initialRef.current = next; setLanguage(next); applyLanguage(next);
    try { localStorage.setItem(KEY, next); } catch { /* The active selection still works for this visit. */ }
  }
  return <label className="language-control" aria-label="Select language"><Languages size={15}/><select value={language} onChange={event => choose(event.target.value as Language)} aria-label="Language">
    {languages.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
  </select></label>;
}
