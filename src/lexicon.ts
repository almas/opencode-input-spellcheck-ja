/**
 * Spellcheck-ja — the offline lexicon and correction engine.
 *
 * `data/lexicon.tsv.gz` is a compact JMdict-derived table (one
 * `surface<TAB>reading` per line, see DATA.md) loaded into memory once.
 * Everything below answers questions about a selected token without ever
 * touching the network: is it a known word, and if not, which single small
 * edit — or a romaji→kana conversion — would turn it into one? Only fixes
 * that exist in the dictionary are ever offered, so the plugin cannot
 * "correct" a correct sentence.
 */
import { gunzipSync } from "node:zlib"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { looksRomaji, romajiToKana } from "./kana"

export interface Lexicon {
  /** every known surface form and reading */
  words: Set<string>
}

/** Where data/lexicon.tsv.gz lives relative to this module. */
export function defaultDataFile(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "data", "lexicon.tsv.gz")
}

let cache: { file: string; lex: Lexicon } | undefined

/** Load (and cache) the word set from the compact table. */
export function loadLexicon(file = defaultDataFile()): Lexicon {
  if (cache && cache.file === file) return cache.lex
  const words = new Set<string>()
  const text = gunzipSync(readFileSync(file)).toString("utf8")
  for (const line of text.split("\n")) {
    if (!line) continue
    const tab = line.indexOf("\t")
    const surface = tab < 0 ? line : line.slice(0, tab)
    const reading = tab < 0 ? "" : line.slice(tab + 1)
    if (surface) words.add(surface)
    if (reading) words.add(reading)
  }
  cache = { file, lex: { words } }
  return cache.lex
}

/** Kana usable as single-character substitutions (hiragana + common marks). */
const KANA = [
  "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん",
  "がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ",
  "ぁぃぅぇぉっゃゅょー",
  "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン",
  "ガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポ",
]
  .join("")
  .split("")

export interface CheckOutcome {
  /** true → nothing to offer; the GUI must not show a menu */
  known: boolean
  /** kana conversion for unconverted romaji (offered first when present) */
  romaji?: string
  /** dictionary words one small edit away from the selection */
  suggestions: string[]
}

const MAX_LENGTH = 12

/** kana that differ only by voicing — a missing dakuten is the most common kana typo */
const VOICED_ROWS = [
  ["か", "き", "く", "け", "こ", "が", "ぎ", "ぐ", "げ", "ご"],
  ["さ", "し", "す", "せ", "そ", "ざ", "じ", "ず", "ぜ", "ぞ"],
  ["た", "ち", "つ", "て", "と", "だ", "ぢ", "づ", "で", "ど"],
  ["は", "ひ", "ふ", "へ", "ほ", "ば", "び", "ぶ", "べ", "ぼ", "ぱ", "ぴ", "ぷ", "ぺ", "ぽ"],
  ["ちゃ", "ぢゃ"],
]
const VOICED_PARTNERS = new Map<string, string[]>()
for (const row of VOICED_ROWS) {
  for (const a of row) {
    const others = row.filter((b) => b !== a)
    VOICED_PARTNERS.set(a, [...(VOICED_PARTNERS.get(a) ?? []), ...others])
  }
}

/**
 * Check one selected token. `known: true` also covers "not our business"
 * (pure latin that is not romaji, too-long strings, whitespace, known words)
 * so the caller can treat it as a single "show nothing" signal.
 */
export function checkSelection(lex: Lexicon, raw: string): CheckOutcome {
  const text = raw.trim()
  if (!text || text.length > MAX_LENGTH || /\s/.test(text)) return { known: true, suggestions: [] }
  if (lex.words.has(text)) return { known: true, suggestions: [] }

  // unconverted romaji: "sikaka" → しかく (only when the kana is a real word)
  if (looksRomaji(text)) {
    const kana = romajiToKana(text)
    if (kana && kana !== text) {
      // the particles は/へ/を are typed wa/e/o: konnichiwa → こんにちは
      // (こんにちわ is a listed reading too, but the particle spelling wins)
      const particle = kana.endsWith("わ") ? "は" : kana.endsWith("え") ? "へ" : kana.endsWith("お") ? "を" : ""
      if (particle) {
        const alt = kana.slice(0, -1) + particle
        if (lex.words.has(alt)) return { known: false, romaji: alt, suggestions: [] }
      }
      if (lex.words.has(kana)) return { known: false, romaji: kana, suggestions: [] }
    }
    // plain english / identifiers / names — never nag about latin text
    if (/^[a-z'-]+$/i.test(text)) return { known: true, suggestions: [] }
  }

  const suggestions = suggestFixes(lex, text)
  if (suggestions.length === 0) return { known: true, suggestions: [] }
  return { known: false, suggestions }
}

/**
 * Words reachable with one small edit: substitution (dakuten partners first,
 * then any kana), adjacent swap, one deletion, one kana insertion. Everything
 * returned is verified against the dictionary, so a suggestion is always a
 * real word. Hits from each class are merged round-robin so a prolific class
 * cannot crowd out the others.
 */
export function suggestFixes(lex: Lexicon, text: string, limit = 6): string[] {
  const voiced: string[] = []
  const subs: string[] = []
  const swaps: string[] = []
  const dels: string[] = []
  const inss: string[] = []
  const seen = new Set<string>([text])
  const chars = [...text]
  const push = (bucket: string[]) => (candidate: string) => {
    if (seen.has(candidate)) return
    seen.add(candidate)
    if (lex.words.has(candidate)) bucket.push(candidate)
  }

  // missing/extra dakuten first — く↔ぐ, か↔が, は↔ば …
  const pushVoiced = push(voiced)
  for (let i = 0; i < chars.length; i++) {
    const before = chars[i] ?? ""
    for (const alt of VOICED_PARTNERS.get(before) ?? []) {
      chars[i] = alt
      pushVoiced(chars.join(""))
    }
    chars[i] = before
  }
  // substitution — other single-character mistakes (かな↔カナ also covered)
  const pushSub = push(subs)
  for (let i = 0; i < chars.length; i++) {
    const before = chars[i] ?? ""
    for (const alt of KANA) {
      if (alt === before) continue
      chars[i] = alt
      pushSub(chars.join(""))
    }
    chars[i] = before
  }
  // adjacent transposition (two morae typed in the wrong order)
  const pushSwap = push(swaps)
  for (let i = 0; i + 1 < chars.length; i++) {
    const a = chars[i] ?? ""
    const b = chars[i + 1] ?? ""
    if (a === b) continue
    chars[i] = b
    chars[i + 1] = a
    pushSwap(chars.join(""))
    chars[i] = a
    chars[i + 1] = b
  }
  // one deletion (typed a mora twice: ありがとうう)
  const pushDel = push(dels)
  for (let i = 0; i < chars.length; i++) {
    pushDel([...chars.slice(0, i), ...chars.slice(i + 1)].join(""))
  }
  // one kana insertion (forgot a mora: とうきょう → とうきょ)
  if (chars.length < MAX_LENGTH) {
    const pushIns = push(inss)
    for (let i = 0; i <= chars.length; i++) {
      for (const ch of KANA) pushIns([...chars.slice(0, i), ch, ...chars.slice(i)].join(""))
    }
  }

  const classes = [voiced, subs, swaps, dels, inss]
  const out: string[] = []
  for (let round = 0; out.length < limit; round++) {
    let added = false
    for (const list of classes) {
      const word = list[round]
      if (word !== undefined && out.length < limit) {
        out.push(word)
        added = true
      }
    }
    if (!added) break
  }
  return out
}
