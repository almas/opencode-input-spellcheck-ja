/**
 * Spellcheck-ja — the server half of the plugin.
 *
 * Registers the `spellcheck-ja` RPC domain over the bundled JMdict lexicon.
 * The gzipped table next to this plugin is loaded into memory on first use;
 * the runtime never reaches the network.
 */
import { Plugin } from "@opencode/plugin"
import { checkSelection, loadLexicon } from "./lexicon"
import { SpellcheckRpc } from "./rpc"

export default Plugin.define({
  id: "spellcheck-ja",
  async setup(ctx) {
    await ctx.rpc.register(SpellcheckRpc, {
      check: async (raw) => {
        const input = (raw ?? {}) as { text?: unknown }
        const text = typeof input.text === "string" ? input.text : ""
        const lex = loadLexicon()
        const outcome = checkSelection(lex, text)
        return {
          known: outcome.known,
          ...(outcome.romaji ? { romaji: outcome.romaji } : {}),
          suggestions: outcome.suggestions,
        }
      },
    })
  },
})
