/**
 * Romaji → kana conversion without any dependency.
 *
 * Longest-match table driven, with the usual special cases: syllabic n
 * (nn / n' / n before a consonant), geminate consonants (tt → っt) and small
 * kana via the x prefix (xa → ぁ). It is deliberately forgiving: we only
 * ever show a conversion when the result turns out to be a real word.
 */

const COMBOS: Record<string, string> = {
  // vowels and semivowels
  a: "あ",
  i: "い",
  u: "う",
  e: "え",
  o: "お",
  wa: "わ",
  wi: "うぃ",
  we: "うぇ",
  wo: "を",
  // basic rows
  ka: "か",
  ki: "き",
  ku: "く",
  ke: "け",
  ko: "こ",
  sa: "さ",
  shi: "し",
  si: "し",
  su: "す",
  se: "せ",
  so: "そ",
  ta: "た",
  chi: "ち",
  ti: "ち",
  tsu: "つ",
  tu: "つ",
  te: "て",
  to: "と",
  na: "な",
  ni: "に",
  nu: "ぬ",
  ne: "ね",
  no: "の",
  ha: "は",
  hi: "ひ",
  fu: "ふ",
  hu: "ふ",
  he: "へ",
  ho: "ほ",
  ma: "ま",
  mi: "み",
  mu: "む",
  me: "め",
  mo: "も",
  ya: "や",
  yu: "ゆ",
  yo: "よ",
  ra: "ら",
  ri: "り",
  ru: "る",
  re: "れ",
  ro: "ろ",
  // dakuten / handakuten
  ga: "が",
  gi: "ぎ",
  gu: "ぐ",
  ge: "げ",
  go: "ご",
  za: "ざ",
  ji: "じ",
  zi: "じ",
  zu: "ず",
  ze: "ぜ",
  zo: "ぞ",
  da: "だ",
  di: "ぢ",
  du: "づ",
  de: "で",
  do: "ど",
  ba: "ば",
  bi: "び",
  bu: "ぶ",
  be: "べ",
  bo: "ぼ",
  pa: "ぱ",
  pi: "ぴ",
  pu: "ぷ",
  pe: "ぺ",
  po: "ぽ",
  // yoon (contracted sounds)
  kya: "きゃ",
  kyu: "きゅ",
  kyo: "きょ",
  sha: "しゃ",
  shu: "しゅ",
  sho: "しょ",
  sya: "しゃ",
  syu: "しゅ",
  syo: "しょ",
  cha: "ちゃ",
  chu: "ちゅ",
  cho: "ちょ",
  tya: "ちゃ",
  tyu: "ちゅ",
  tyo: "ちょ",
  nya: "にゃ",
  nyu: "にゅ",
  nyo: "にょ",
  hya: "ひゃ",
  hyu: "ひゅ",
  hyo: "ひょ",
  mya: "みゃ",
  myu: "みゅ",
  myo: "みょ",
  rya: "りゃ",
  ryu: "りゅ",
  ryo: "りょ",
  gya: "ぎゃ",
  gyu: "ぎゅ",
  gyo: "ぎょ",
  ja: "じゃ",
  ju: "じゅ",
  jo: "じょ",
  zya: "じゃ",
  zyu: "じゅ",
  zyo: "じょ",
  bya: "びゃ",
  byu: "びゅ",
  byo: "びょ",
  pya: "ぴゃ",
  pyu: "ぴゅ",
  pyo: "ぴょ",
  // small kana via x
  xa: "ぁ",
  xi: "ぃ",
  xu: "ぅ",
  xe: "ぇ",
  xo: "ぉ",
  xtu: "っ",
  xtsu: "っ",
  xwa: "ゎ",
  xka: "ゕ",
  xke: "ゖ",
  // long vowel mark
  "-": "ー",
}

// "n" only becomes ん through the explicit rules below (nn / n' / n+consonant),
// so it is looked up separately from the greedy table.
delete COMBOS.n

/** Sorted longest-first so "shi" beats "si", "kya" beats "ka". */
const KEYS = Object.keys(COMBOS).sort((a, b) => b.length - a.length)

const ROMAJI_RE = /^[a-z'-]+$/i

/** Quick check: does this look like romaji at all? */
export function looksRomaji(text: string): boolean {
  return ROMAJI_RE.test(text) && /[aeiouy]/i.test(text)
}

const VOWELS = "aeiou"

/**
 * Convert romaji to kana. Returns undefined when any segment fails to map,
 * so half-converted garbage is never shown.
 */
export function romajiToKana(input: string): string | undefined {
  const text = input.toLowerCase()
  if (!text || !ROMAJI_RE.test(text)) return undefined
  let out = ""
  let i = 0
  while (i < text.length) {
    const ch = text[i] ?? ""

    // syllabic n: n', n at the end, or n before a consonant (n included).
    // "nn…" converts only the first n so the second can start the next
    // syllable (konnichiwa → こんにちは); a pair ending the input is one ん.
    if (ch === "n") {
      const next = text[i + 1]
      const beforeConsonant = next !== undefined && !VOWELS.includes(next) && next !== "y" && next !== "-"
      if (next === undefined || next === "'" || beforeConsonant) {
        out += "ん"
        i += next === "n" && i + 2 >= text.length ? 2 : 1
        continue
      }
    }

    // stray apostrophe separator (te'nki)
    if (ch === "'") {
      i += 1
      continue
    }

    let matched = false
    for (const key of KEYS) {
      if (text.startsWith(key, i)) {
        out += COMBOS[key]
        i += key.length
        matched = true
        break
      }
    }
    if (matched) continue

    // doubled consonant (kk, tt, ss …): small tsu, then the consonant itself
    if (i + 1 < text.length && text[i + 1] === ch && !VOWELS.includes(ch) && ch !== "n" && ch !== "y" && ch !== "-") {
      out += "っ"
      i += 1
      continue
    }
    return undefined
  }
  return out || undefined
}
