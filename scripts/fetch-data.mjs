/**
 * Rebuild the bundled lexicon (data/lexicon.tsv.gz) from upstream.
 *
 * Runtime never touches the network; this script is only run when we want
 * to refresh the data. Source: jmdict-simplified (scriptin/jmdict-simplified,
 * derived from JMdict, CC BY-SA 4.0 — see DATA.md).
 *
 * Usage: node scripts/fetch-data.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs"
import { gzipSync } from "node:zlib"
import { execSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const TAG = "3.6.2+20261116213322"
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "data")
const TMP = join(OUT, ".fetch-tmp")

mkdirSync(TMP, { recursive: true })
const zip = join(TMP, "jmdict.zip")
if (!existsSync(zip)) {
  execSync(
    `curl -sL --fail -o ${JSON.stringify(zip)} ${JSON.stringify(
      `https://github.com/scriptin/jmdict-simplified/releases/download/${encodeURIComponent(TAG)}/jmdict-eng-common-${TAG}.json.zip`,
    )}`,
    { stdio: "inherit" },
  )
}
execSync(`cd ${JSON.stringify(TMP)} && unzip -o -q jmdict.zip`)

// one `surface<TAB>reading` line per surface/reading pair (reading omitted
// when identical to the surface); the spellcheck engine only needs to know
// which strings are real words.
const jmdict = JSON.parse(readFileSync(join(TMP, `jmdict-eng-common-${TAG}.json`), "utf8"))
const seen = new Set()
const lines = []
for (const entry of jmdict.words ?? []) {
  const reads = (entry.kana ?? []).map((k) => k.text)
  const writes = (entry.kanji ?? []).map((k) => k.text)
  const pairs = writes.length > 0 ? writes.flatMap((w) => reads.map((r) => [w, r])) : reads.map((r) => [r, r])
  for (const [surface, reading] of pairs) {
    const key = reading && reading !== surface ? `${surface}\t${reading}` : surface
    if (seen.has(key)) continue
    seen.add(key)
    lines.push(key)
  }
}
lines.sort((a, b) => (a < b ? -1 : 1))
writeFileSync(join(OUT, "lexicon.tsv.gz"), gzipSync(Buffer.from(lines.join("\n") + "\n"), { level: 9 }))
console.log(`lexicon entries=${lines.length}`)
rmSync(TMP, { recursive: true, force: true })
