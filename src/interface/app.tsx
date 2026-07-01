import { Box, useApp, useInput } from "ink"
import { useRef, useState } from "react"
import { Header } from "./components/header"
import { MessageView } from "./components/message-view"
import { PromptLine } from "./components/prompt-line"
import { StatusLine } from "./components/status-line"
import type { LoginOption, LoginService } from "./login"
import type { ModelController } from "./model"
import type { SelectOption } from "./prompt"
import { SelectPrompt } from "./prompt"
import type { Responder } from "./responder"
import type { Message, Role } from "./types"

type Mode = "chat" | "selecting-login" | "selecting-model"

export interface AppProps {
  responder: Responder
  greeting?: string
  login?: LoginService
  models?: ModelController
}

export function App({ responder, greeting, login, models }: AppProps) {
  const { exit } = useApp()
  const idRef = useRef(0)
  const [messages, setMessages] = useState<Message[]>(() =>
    greeting === undefined ? [] : [{ id: 0, role: "assistant", content: greeting }],
  )
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<Mode>("chat")

  function addMessage(role: Role, content: string) {
    idRef.current += 1
    const message: Message = { id: idRef.current, role, content }
    setMessages((prev) => [...prev, message])
  }

  async function submit(text: string) {
    const trimmed = text.trim()
    if (trimmed.length === 0) return
    if (trimmed === "/exit" || trimmed === "/quit") {
      exit()
      return
    }
    if (trimmed === "/login") {
      setDraft("")
      if (login === undefined) addMessage("assistant", "登录暂不可用。")
      else setMode("selecting-login")
      return
    }
    if (trimmed === "/model") {
      setDraft("")
      if (models === undefined || models.list().length === 0) {
        addMessage("assistant", "没有可选模型。")
      } else {
        setMode("selecting-model")
      }
      return
    }

    const history = messages
    addMessage("user", trimmed)
    setDraft("")
    setBusy(true)

    let reply: string
    try {
      reply = await responder.respond(trimmed, history)
    } catch (error) {
      reply = `⚠ 出错：${error instanceof Error ? error.message : String(error)}`
    }
    addMessage("assistant", reply)
    setBusy(false)
  }

  async function runLoginOption(option: LoginOption) {
    setMode("chat")
    setBusy(true)
    addMessage("assistant", `开始登录：${option.label}`)
    try {
      const result = await option.run((info) => addMessage("assistant", info))
      addMessage("assistant", result)
    } catch (error) {
      addMessage(
        "assistant",
        `⚠ 登录失败：${error instanceof Error ? error.message : String(error)}`,
      )
    }
    setBusy(false)
  }

  function selectModel(id: string) {
    setMode("chat")
    models?.select(id)
    addMessage("assistant", `已切换模型：${id}`)
  }

  useInput((input, key) => {
    // 非聊天模式（登录/模型选择）时，让 SelectPrompt 接管按键。
    if (busy || mode !== "chat") return
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

  const loginOptions: SelectOption<LoginOption>[] =
    login === undefined
      ? []
      : login.options.map((option) => ({ label: option.label, value: option }))
  const modelOptions: SelectOption<string>[] =
    models === undefined ? [] : models.list().map((m) => ({ label: m.label, value: m.id }))

  return (
    <Box flexDirection="column">
      <Header />
      <MessageView messages={messages} />
      {mode === "selecting-login" ? (
        <SelectPrompt message="选择登录方式：" options={loginOptions} onSelect={runLoginOption} />
      ) : mode === "selecting-model" ? (
        <SelectPrompt message="选择模型：" options={modelOptions} onSelect={selectModel} />
      ) : busy ? (
        <StatusLine />
      ) : (
        <PromptLine value={draft} />
      )}
    </Box>
  )
}
