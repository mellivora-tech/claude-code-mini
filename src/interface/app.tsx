import { Box, useApp, useInput } from "ink"
import { useRef, useState } from "react"
import { Header } from "./components/header"
import { MessageView } from "./components/message-view"
import { PromptLine } from "./components/prompt-line"
import { StatusLine } from "./components/status-line"
import type { Responder } from "./responder"
import type { Message } from "./types"

export interface AppProps {
  responder: Responder
  greeting?: string
}

export function App({ responder, greeting }: AppProps) {
  const { exit } = useApp()
  const idRef = useRef(0)
  const [messages, setMessages] = useState<Message[]>(() =>
    greeting === undefined ? [] : [{ id: 0, role: "assistant", content: greeting }],
  )
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit(text: string) {
    const trimmed = text.trim()
    if (trimmed.length === 0) return
    if (trimmed === "/exit" || trimmed === "/quit") {
      exit()
      return
    }

    const history = messages
    idRef.current += 1
    const userMessage: Message = { id: idRef.current, role: "user", content: trimmed }
    setMessages((prev) => [...prev, userMessage])
    setDraft("")
    setBusy(true)

    let reply: string
    try {
      reply = await responder.respond(trimmed, history)
    } catch (error) {
      reply = `⚠ 出错：${error instanceof Error ? error.message : String(error)}`
    }

    idRef.current += 1
    const assistantMessage: Message = { id: idRef.current, role: "assistant", content: reply }
    setMessages((prev) => [...prev, assistantMessage])
    setBusy(false)
  }

  useInput((input, key) => {
    if (busy) return
    if (key.return) {
      void submit(draft)
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
      {busy ? <StatusLine /> : <PromptLine value={draft} />}
    </Box>
  )
}
