/**
 * Spellcheck-ja — RPC contract shared by the server and GUI halves.
 *
 * Plain JSON Schema literals: the server validates input and output with
 * them, and the GUI types its client proxy from the same definition.
 */
import type { Rpc } from "@opencode/schema/rpc"

export const SpellcheckRpc = {
  id: "spellcheck-ja",
  methods: {
    // Check one selected token; everything is answered from the bundled data.
    check: {
      input: {
        type: "object",
        properties: {
          text: { type: "string", description: "the selected token (no spaces)" },
        },
        required: ["text"],
      },
      output: {
        type: "object",
        properties: {
          known: { type: "boolean", description: "true when there is nothing to offer" },
          romaji: { type: "string", description: "kana conversion for unconverted romaji" },
          suggestions: {
            type: "array",
            items: { type: "string" },
            description: "real dictionary words one small edit away",
          },
        },
        required: ["known", "suggestions"],
      },
    },
  },
  events: {},
} satisfies Rpc.PortableDefinition
