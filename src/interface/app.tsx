import { Box, useApp, useInput } from "ink"
import { useRef, useState } from "react"
import type { Command, CommandChoice, CommandContext } from "./command"
import { Header } from "./components/header"
import { MessageView } from "./components/message-view"
import { PromptLine } from "./components/prompt-line"
import { StatusLine } from "./components/status-line"
import { SelectPrompt, TextPrompt } from "./prompt"
import type { Responder } from "./responder"
import type { Message, Role } from "./types"

// 通用交互态：命令通过 ctx.select / ctx.promptText 驱动，替代每命令一个 mode。
type Interaction =
  | {
      kind: "select"
      message: string
      items: CommandChoice<unknown>[]
      onSelect: (value: unknown) => void
    }
  | { kind: "text"; label: string; onSubmit: (value: string) => void; onCancel: () => void }

export interface AppProps {
  responder: Responder
  greeting?: string
  commands?: Command[]
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function App({ responder, greeting, commands = [] }: AppProps) {
  const { exit } = useApp()
  const idRef = useRef(0)
  const [messages, setMessages] = useState<Message[]>(() =>
    greeting === undefined ? [] : [{ id: 0, role: "assistant", content: greeting, meta: true }],
  )
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [interaction, setInteraction] = useState<Interaction | null>(null)

  function addMessage(role: Role, content: string, meta: boolean) {
    idRef.current += 1
    setMessages((prev) => [...prev, { id: idRef.current, role, content, meta }])
  }

  function makeContext(): CommandContext {
    return {
      print: (message) => addMessage("assistant", message, true),
      select: <T,>(message: string, items: CommandChoice<T>[]): Promise<T> =>
        new Promise<T>((resolve) => {
          setInteraction({
            kind: "select",
            message,
            items: items as CommandChoice<unknown>[],
            onSelect: (value) => resolve(value as T),
          })
        }),
      promptText: (label: string): Promise<string> =>
        new Promise<string>((resolve, reject) => {
          setInteraction({
            kind: "text",
            label,
            onSubmit: resolve,
            onCancel: () => reject(new Error("已取消")),
          })
        }),
      exit: () => exit(),
    }
  }

  async function runCommand(cmd: Command) {
    setBusy(true)
    try {
      await cmd.run(makeContext())
    } catch (error) {
      addMessage("assistant", `⚠ /${cmd.name} 出错：${errorText(error)}`, true)
    } finally {
      setBusy(false)
      setInteraction(null)
    }
  }

  async function submit(text: string) {
    const trimmed = text.trim()
    if (trimmed.length === 0) return

    if (trimmed.startsWith("/")) {
      setDraft("")
      const name = trimmed.slice(1).trim()
      const cmd = commands.find((c) => c.name === name)
      if (cmd === undefined) {
        addMessage("assistant", `未知命令：${trimmed}`, true)
        return
      }
      await runCommand(cmd)
      return
    }

    // 模型历史只取非 meta 的真实对话轮次。
    const history = messages.filter((m) => m.meta !== true)
    addMessage("user", trimmed, false)
    setDraft("")
    setBusy(true)

    let reply: string
    let replyIsMeta = false
    try {
      reply = await responder.respond(trimmed, history)
    } catch (error) {
      reply = `⚠ 出错：${errorText(error)}`
      replyIsMeta = true // 错误提示不回灌进模型历史
    }
    addMessage("assistant", reply, replyIsMeta)
    setBusy(false)
  }

  function handleSelect(value: unknown) {
    const current = interaction
    setInteraction(null)
    if (current?.kind === "select") current.onSelect(value)
  }

  function handleTextSubmit(value: string) {
    const current = interaction
    setInteraction(null)
    if (current?.kind === "text") current.onSubmit(value)
  }

  function handleTextCancel() {
    const current = interaction
    setInteraction(null)
    if (current?.kind === "text") current.onCancel()
  }

  useInput((input, key) => {
    // 交互中（select/text）或忙时，让对应组件接管按键。
    if (busy || interaction !== null) return
    if (key.return) {
      submit(draft).catch((error) => {
        setBusy(false)
        addMessage("assistant", `⚠ 出错：${errorText(error)}`, true)
      })
      return
    }
    if (key.ctrl && input === "c") {
      exit()
      return
    }
    if (key.backspace || key.delete) {
      setDraft((current) => current.slice(0, -1))
      return
    }
    if (input.length > 0 && !key.ctrl && !key.meta) {
      setDraft((current) => current + input)
    }
  })

  return (
    <Box flexDirection="column">
      <Header />
      <MessageView messages={messages} />
      {interaction?.kind === "select" ? (
        <SelectPrompt
          message={interaction.message}
          options={interaction.items}
          onSelect={handleSelect}
        />
      ) : interaction?.kind === "text" ? (
        <TextPrompt
          label={interaction.label}
          onSubmit={handleTextSubmit}
          onCancel={handleTextCancel}
        />
      ) : busy ? (
        <StatusLine />
      ) : (
        <PromptLine value={draft} />
      )}
    </Box>
  )
}
