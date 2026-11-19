/**
 * Spellcheck-ja — the GUI half of the plugin.
 *
 * Select a Japanese (or unconverted romaji) token in the composer or any
 * input box and right-click it: when the dictionary half finds a confident
 * fix — a romaji→kana conversion or one-edit real words — a small menu
 * offers it and replaces the selection through execCommand("insertText") so
 * the composer keeps its chips and history. When there is nothing to offer
 * the native context menu is re-dispatched and stays untouched, which makes
 * the whole thing zero-noise for correct text and for latin words.
 */
import { For, Show, createSignal, onCleanup, type JSX } from "solid-js"
import { Portal } from "solid-js/web"
import { Plugin, Slot } from "@opencode/plugin/gui"
import { SpellcheckRpc } from "./rpc"

/** Typed view of the server methods we call. */
interface SpellcheckService {
  check(input: { text: string }): Promise<{ known: boolean; romaji?: string; suggestions: string[] }>
}

/** Menu theme following the host (coarse dark/light detection). */
function menuPalette() {
  const bg = getComputedStyle(document.body).backgroundColor
  const rgb = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/.exec(bg)
  let dark = true
  if (rgb) dark = (Number(rgb[1]) * 299 + Number(rgb[2]) * 587 + Number(rgb[3]) * 114) / 1000 < 128
  return dark
    ? {
        background: "#26262b",
        color: "#e9e9ea",
        border: "1px solid rgba(255,255,255,0.14)",
        soft: "rgba(255,255,255,0.55)",
        hover: "rgba(255,255,255,0.10)",
        accent: "rgba(120,140,255,0.9)",
      }
    : {
        background: "#ffffff",
        color: "#232326",
        border: "1px solid rgba(0,0,0,0.18)",
        soft: "rgba(0,0,0,0.55)",
        hover: "rgba(0,0,0,0.06)",
        accent: "rgba(70,90,220,0.9)",
      }
}

/** Editable element under the pointer (textarea / input / contenteditable). */
function editableUnder(event: MouseEvent): HTMLElement | undefined {
  for (const node of event.composedPath()) {
    if (!(node instanceof Element)) continue
    if (node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement) return node
    if (node instanceof HTMLElement && node.isContentEditable) return node
  }
  return undefined
}

/** Selected text within the editable (or the whole DOM selection). */
function selectionIn(el: HTMLElement): string {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const start = el.selectionStart
    const end = el.selectionEnd
    if (start == null || end == null || start === end) return ""
    return el.value.slice(start, end)
  }
  return window.getSelection()?.toString() ?? ""
}

/** Replace the live selection without breaking composer state. */
function replaceSelection(word: string): void {
  const el = document.activeElement
  if (typeof document.execCommand === "function") {
    const ok = document.execCommand("insertText", false, word)
    if (ok) return
  }
  // fallback for plain fields where execCommand is unavailable
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    el.setRangeText(word, start, end, "end")
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: word }))
  }
}

export default Plugin.define({
  i18n: {
    "en": {
      "spellcheck.check.title": "Spellcheck",
      "spellcheck.check.convert": "Convert “{from}” → {to}",
      "spellcheck.check.suggest": "Replace with {word}",
    },
    "ja": {
      "spellcheck.check.title": "入力チェック",
      "spellcheck.check.convert": "「{from}」を {to} に変換",
      "spellcheck.check.suggest": "{word} に置き換える",
    },
  },
  setup(ctx) {
    const rpc = ctx.client.rpc(SpellcheckRpc) as unknown as SpellcheckService

    const [menu, setMenu] = createSignal<{
      x: number
      y: number
      text: string
      romaji?: string
      suggestions: string[]
    } | null>(null)

    let menuEl: HTMLDivElement | undefined
    const close = () => setMenu(null)

    /** Right-clicks we swallow and then decide to release get flagged so
     * they don't loop back through our own handler. */
    let redispatching = false
    const openNativeMenu = (source: MouseEvent) => {
      const clone = new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: source.clientX,
        clientY: source.clientY,
      })
      redispatching = true
      ;(source.target ?? window).dispatchEvent(clone)
      setTimeout(() => (redispatching = false), 0)
    }

    const onContextMenu = (event: MouseEvent) => {
      if (event.defaultPrevented || redispatching) return
      if (menu() && menuEl?.contains(event.target as Node)) return
      const field = editableUnder(event)
      if (!field) return // message bodies are the dictionary plugin's turf
      const text = selectionIn(field).trim()
      if (!text || text.length > 12 || /\s/.test(text)) return
      const japanese = /[\u3000-\u30ff\u3400-\u9fff\uf900-\ufaff]/.test(text)
      const latin = /^[a-z'-]+$/i.test(text)
      if (!japanese && !latin) return

      // hold the native menu while we consult the dictionary
      event.preventDefault()
      event.stopPropagation()
      void (async () => {
        let result: { known: boolean; romaji?: string; suggestions: string[] }
        try {
          result = await rpc.check({ text })
        } catch {
          openNativeMenu(event)
          return
        }
        if (result.known && !result.romaji && result.suggestions.length === 0) {
          openNativeMenu(event)
          return
        }
        setMenu({
          x: event.clientX,
          y: event.clientY,
          text,
          ...(result.romaji ? { romaji: result.romaji } : {}),
          suggestions: result.suggestions.slice(0, 5),
        })
      })()
    }

    const onPointerDown = (event: PointerEvent) => {
      if (menu() && !menuEl?.contains(event.target as Node)) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (menu() && event.key === "Escape") close()
    }
    window.addEventListener("contextmenu", onContextMenu, true)
    window.addEventListener("pointerdown", onPointerDown, true)
    window.addEventListener("keydown", onKeyDown, true)
    window.addEventListener("scroll", close, true)
    window.addEventListener("blur", close)
    onCleanup(() => {
      window.removeEventListener("contextmenu", onContextMenu, true)
      window.removeEventListener("pointerdown", onPointerDown, true)
      window.removeEventListener("keydown", onKeyDown, true)
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("blur", close)
    })

    const replace = (word: string) => {
      close()
      replaceSelection(word)
    }

    const Item = (props: { label: string; onClick: () => void }): JSX.Element => {
      const p = menuPalette()
      return (
        <div
          style={{
            padding: "6px 10px",
            "border-radius": "6px",
            cursor: "pointer",
            "font-size": "13px",
            color: p.color,
          }}
          onMouseEnter={(event) => (event.currentTarget.style.background = p.hover)}
          onMouseLeave={(event) => (event.currentTarget.style.background = "transparent")}
          onClick={() => props.onClick()}
        >
          {props.label}
        </div>
      )
    }

    ctx.add(Slot, {
      at: "window.bottom",
      render: () => (
        <Show when={menu()}>
          {(entry) => {
            const p = menuPalette()
            return (
              <Portal mount={document.body}>
                <div
                  ref={menuEl}
                  style={{
                    position: "fixed",
                    left: `${Math.min(entry().x, window.innerWidth - 300)}px`,
                    top: `${Math.min(entry().y, window.innerHeight - 40 * (2 + entry().suggestions.length))}px`,
                    "z-index": "2147483647",
                    "min-width": "220px",
                    "max-width": "320px",
                    background: p.background,
                    color: p.color,
                    border: p.border,
                    "border-radius": "8px",
                    padding: "4px",
                    "box-shadow": "0 10px 28px rgba(0,0,0,0.45)",
                    "font-family": "system-ui, sans-serif",
                    "user-select": "none",
                  }}
                  // keep the field's selection alive while clicking
                  onMouseDown={(event) => event.preventDefault()}
                >
                  <div style={{ padding: "4px 10px 2px", "font-size": "11px", color: p.soft }}>
                    {ctx.t("spellcheck.check.title")}「{entry().text}」
                  </div>
                  <Show when={entry().romaji}>
                    {(kana) => (
                      <Item
                        label={ctx.t("spellcheck.check.convert").replace("{from}", entry().text).replace("{to}", kana())}
                        onClick={() => replace(kana())}
                      />
                    )}
                  </Show>
                  <For each={entry().suggestions}>
                    {(word) => (
                      <Item
                        label={ctx.t("spellcheck.check.suggest").replace("{word}", word)}
                        onClick={() => replace(word)}
                      />
                    )}
                  </For>
                </div>
              </Portal>
            )
          }}
        </Show>
      ),
    })
  },
})
