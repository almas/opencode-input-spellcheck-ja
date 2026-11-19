# Bundled data, sources and licenses

`data/lexicon.tsv.gz` is built from JMdict via jmdict-simplified and served
entirely offline at runtime.

| File | Content | Source | License |
| --- | --- | --- | --- |
| `lexicon.tsv.gz` | 共通語彙の表層形＋読み（タブ区切り） | [jmdict-simplified](https://github.com/scriptin/jmdict-simplified) 3.6.2 ＋ JMdict (EDRDG) | CC BY-SA 4.0 |

## Attribution

This package contains readings derived from the JMdict electronic dictionary
maintained by the Electronic Dictionary Research and Development Group, used
under the Creative Commons Attribution-ShareAlike 4.0 licence.

The word list is converted with [jmdict-simplified](https://github.com/scriptin/jmdict-simplified),
also distributed under CC BY-SA 4.0.

## License notes

Because the dictionary data is CC BY-SA, derived databases (such as the
bundled lexicon table) are offered under CC BY-SA 4.0 as well; the
plugin's own source code remains MIT.

## Rebuilding

```bash
npm run fetch-data   # 開発時のみネットワークを使用
```
