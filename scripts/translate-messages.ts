import fs from 'fs';
import path from 'path';
import { translateContent } from '../src/ai/flows/enrichment';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type Translations = {
  fr: string;
  es: string;
  uk: string;
};

const TARGET_LANGS = ['fr', 'es', 'uk'] as const;

function collectStrings(value: JsonValue, set: Set<string>) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      set.add(value);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, set);
    }
    return;
  }

  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      collectStrings(item as JsonValue, set);
    }
  }
}

function applyTranslations(value: JsonValue, lang: keyof Translations, map: Map<string, Translations>): JsonValue {
  if (typeof value === 'string') {
    return map.get(value)?.[lang] ?? value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => applyTranslations(item, lang, map));
  }

  if (value && typeof value === 'object') {
    const result: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = applyTranslations(item as JsonValue, lang, map);
    }
    return result;
  }

  return value;
}

async function translateAll(strings: string[]): Promise<Map<string, Translations>> {
  const translations = new Map<string, Translations>();

  for (let index = 0; index < strings.length; index += 1) {
    const text = strings[index];
    if (translations.has(text)) {
      continue;
    }

    try {
      const result = await translateContent({
        text,
        sourceLocale: 'pl',
        targetLocales: [...TARGET_LANGS],
      });

      translations.set(text, {
        fr: result.translations?.fr || text,
        es: result.translations?.es || text,
        uk: result.translations?.uk || text,
      });
    } catch {
      translations.set(text, { fr: text, es: text, uk: text });
    }

    if ((index + 1) % 20 === 0) {
      console.log(`Translated ${index + 1} / ${strings.length}`);
    }
  }

  return translations;
}

async function main() {
  const messagesDir = path.join(process.cwd(), 'messages');
  const files = fs.readdirSync(messagesDir);
  const skip = new Set(['toolsInventory.json']);

  const baseFiles = files.filter((file) => {
    if (!file.endsWith('.json')) return false;
    if (file.endsWith('.en.json')) return false;
    if (file.endsWith('.de.json')) return false;
    if (file.endsWith('.fr.json')) return false;
    if (file.endsWith('.es.json')) return false;
    if (file.endsWith('.uk.json')) return false;
    return !skip.has(file);
  });

  const parsedFiles: Array<{ name: string; data: JsonValue }> = [];
  const uniqueStrings = new Set<string>();

  for (const file of baseFiles) {
    const filePath = path.join(messagesDir, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw) as JsonValue;
    parsedFiles.push({ name: file.replace(/\.json$/, ''), data });
    collectStrings(data, uniqueStrings);
  }

  const strings = Array.from(uniqueStrings);
  console.log(`Total strings to translate: ${strings.length}`);

  const translations = await translateAll(strings);

  for (const { name, data } of parsedFiles) {
    for (const lang of TARGET_LANGS) {
      const localized = applyTranslations(data, lang, translations);
      const outPath = path.join(messagesDir, `${name}.${lang}.json`);
      fs.writeFileSync(outPath, JSON.stringify(localized, null, 2) + '\n');
    }
  }

  console.log('Translation complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
