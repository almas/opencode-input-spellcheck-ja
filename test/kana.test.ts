import { describe, expect, it } from "vitest"
import { looksRomaji, romajiToKana } from "../src/kana"

describe("romajiToKana", () => {
  it("converts ordinary syllables", () => {
    expect(romajiToKana("sensei")).toBe("せんせい")
    expect(romajiToKana("sakana")).toBe("さかな")
    expect(romajiToKana("toukyou")).toBe("とうきょう")
  })

  it("converts yoon and small kana", () => {
    expect(romajiToKana("kyou")).toBe("きょう")
    expect(romajiToKana("shachou")).toBe("しゃちょう")
    expect(romajiToKana("sakka")).toBe("さっか")
    expect(romajiToKana("kitte")).toBe("きって")
    expect(romajiToKana("xtu")).toBe("っ")
  })

  it("handles syllabic n", () => {
    // the converter is mechanical; こんにちは spelling comes via the lexicon
    expect(romajiToKana("konnichiwa")).toBe("こんにちわ")
    expect(romajiToKana("annai")).toBe("あんない")
    expect(romajiToKana("shin")).toBe("しん")
    expect(romajiToKana("kan")).toBe("かん")
    expect(romajiToKana("hon")).toBe("ほん")
    expect(romajiToKana("te'ki")).toBe("てき")
  })

  it("rejects things that are not romaji", () => {
    expect(romajiToKana("hello123")).toBeUndefined()
    expect(romajiToKana("")).toBeUndefined()
    expect(romajiToKana("qg")).toBeUndefined()
  })

  it("looksRomaji gates the feature cheaply", () => {
    expect(looksRomaji("sikaka")).toBe(true)
    expect(looksRomaji("日本語")).toBe(false)
    expect(looksRomaji("rhythm")).toBe(true)
  })
})
