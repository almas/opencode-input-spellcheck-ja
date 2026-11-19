import { describe, expect, it } from "vitest"
import { checkSelection, loadLexicon } from "../src/lexicon"

const lex = loadLexicon()

describe("lexicon", () => {
  it("knows common words and readings", () => {
    expect(lex.words.has("日本語")).toBe(true)
    expect(lex.words.has("入力")).toBe(true)
    expect(lex.words.has("しかく")).toBe(true)
  })

  it("stays silent for known words and latin text", () => {
    expect(checkSelection(lex, "入力").known).toBe(true)
    expect(checkSelection(lex, "function").known).toBe(true)
    expect(checkSelection(lex, "hello").known).toBe(true)
    expect(checkSelection(lex, "opencode").known).toBe(true)
  })

  it("offers romaji conversion for unconverted input", () => {
    const outcome = checkSelection(lex, "sensei")
    expect(outcome.known).toBe(false)
    expect(outcome.romaji).toBe("せんせい")
  })

  it("spells the topic particle は for typed \"wa\"", () => {
    expect(checkSelection(lex, "konnichiwa").romaji).toBe("こんにちは")
    expect(checkSelection(lex, "sakka").romaji).toBe("さっか")
  })

  it("suggests real one-edit words for kana typos", () => {
    const outcome = checkSelection(lex, "ほし")
    // at minimum, every offer must be a dictionary word
    for (const s of outcome.suggestions) expect(lex.words.has(s)).toBe(true)
    // known words stay silent
    expect(checkSelection(lex, "たべる").known).toBe(true)
  })

  it("fixes a voiced-mark mistake", () => {
    const outcome = checkSelection(lex, "およく") // く should be ぐ
    expect(outcome.known).toBe(false)
    expect(outcome.suggestions).toContain("およぐ")
  })

  it("ignores long strings and whitespace", () => {
    expect(checkSelection(lex, "とてもながいせいぶんではありません").known).toBe(true)
    expect(checkSelection(lex, "にほん ご").known).toBe(true)
  })

  it("only ever suggests words that exist", () => {
    const outcome = checkSelection(lex, "とうきょ") // missing う
    expect(outcome.known).toBe(false)
    expect(outcome.suggestions).toContain("とうきょう")
    for (const s of outcome.suggestions) expect(lex.words.has(s)).toBe(true)
  })
})
