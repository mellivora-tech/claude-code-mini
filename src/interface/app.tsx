import { Box, useApp, useInput } from "ink"
import { useRef, useState } from "react"
import type { QueryEvent } from "../agent/events"
import { Header } from "./components/header"
import { MessageView } from "./components/message-view"
import { PromptLine } from "./components/prompt-line"
import { StatusLine } from "./components/status-line"
import type { LoginContext, LoginOption, LoginService } from "./login"
import type { ModelChoice, ModelController } from "./model"
import type { SelectOption } from "./prompt"
import { SelectPrompt, TextPrompt } from "./prompt"
import type { ConfirmFn, Responder } from "./responder"
import type { Message, Role } from "./types"

type Mode = "chat" | "selecting-login" | "selecting-model" | "text-input"

interface PendingText {
  label: string
  resolve: (value: string) => void
  reject: (reason: Error) => void
}

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
  const [modelChoices, setModelChoices] = useState<ModelChoice[]>([])
  const [pendingText, setPendingText] = useState<PendingText | null>(null)

  function addMessage(role: Role, content: string): number {
    idRef.current += 1
    const id = idRef.current
    setMessages((prev) => [...prev, { id, role, content }])
    return id
  }

  function appendTo(id: number, text: string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: m.content + text } : m)))
  }

  function setContent(id: number, content: string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content } : m)))
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
      await openModelSelect()
      return
    }

    addMessage("user", trimmed)
    setDraft("")
    setBusy(true)
    try {
      await consume(responder.send(trimmed, confirmTool))
    } catch (error) {
      addMessage("assistant", `⚠ 出错：${error instanceof Error ? error.message : String(error)}`)
    }
    setBusy(false)
  }

  // 消费一轮事件流：text_delta 打字机、tool_* 状态行、done 收尾。
  async function consume(events: AsyncIterable<QueryEvent>) {
    let streamingId: number | null = null // 当前正在追加文本的 assistant 气泡
    const toolLines = new Map<string, number>() // callId → 状态行消息 id
    for await (const event of events) {
      if (event.type === "text_delta") {
        if (streamingId === null) streamingId = addMessage("assistant", "")
        appendTo(streamingId, event.text)
      } else if (event.type === "tool_start") {
        streamingId = null // 工具后的文本另起气泡，排在工具行下方
        toolLines.set(event.call.id, addMessage("system", `⚙ ${event.call.name} 运行中…`))
      } else if (event.type === "tool_result") {
        const id = toolLines.get(event.callId)
        const mark = event.isError ? "✗" : "✓"
        const summary = event.output.replace(/\s+/g, " ").slice(0, 80)
        if (id !== undefined) setContent(id, `⚙ ${mark} ${summary}`)
      } else if (event.type === "done") {
        streamingId = null
        if (event.reason === "aborted") addMessage("system", "⏹ 已中断")
        else if (event.reason === "error") addMessage("assistant", `⚠ 出错：${event.message ?? ""}`)
        else if (event.reason === "max_steps") addMessage("system", "⏹ 达到单轮步数上限")
      }
      // assistant / usage 事件不单独渲染：文本靠 text_delta 呈现，用量暂不显示。
    }
  }

  // 危险操作确认：复用文本输入框问 y/n；Esc 取消视为拒绝。
  const confirmTool: ConfirmFn = async (call) => {
    try {
      const answer = await requestText(`允许执行 ${call.name}？输入 y 允许，其他拒绝：`)
      return answer.trim().toLowerCase() === "y"
    } catch {
      return false
    }
  }

  async function openModelSelect() {
    if (models === undefined) {
      addMessage("assistant", "没有可选模型。")
      return
    }
    const choices = await models.list()
    if (choices.length === 0) {
      addMessage("assistant", "没有可选模型。")
      return
    }
    setModelChoices(choices)
    setMode("selecting-model")
  }

  // 索取一行文本输入：切到 text-input 模式，回车 resolve、Esc reject。
  function requestText(label: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      setPendingText({ label, resolve, reject })
      setMode("text-input")
    })
  }

  function onTextSubmit(value: string) {
    const pending = pendingText
    setPendingText(null)
    setMode("chat")
    pending?.resolve(value)
  }

  function onTextCancel() {
    const pending = pendingText
    setPendingText(null)
    setMode("chat")
    pending?.reject(new Error("已取消"))
  }

  async function runLoginOption(option: LoginOption) {
    setMode("chat")
    setBusy(true)
    addMessage("assistant", `开始：${option.label}`)
    const ctx: LoginContext = {
      info: (info) => addMessage("assistant", info),
      prompt: (label) => requestText(label),
    }
    try {
      const result = await option.run(ctx)
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
    // Ctrl+C：忙时中断当前轮，闲时退出。始终优先处理。
    if (key.ctrl && input === "c") {
      if (busy) responder.interrupt()
      else exit()
      return
    }
    // 非聊天模式（登录/模型选择/文本输入）或忙时，让对应组件接管按键。
    if (busy || mode !== "chat") return
    if (key.return) {
      // 兜底：submit 任何分支（含 /model 的异步列举）抛错都渲进 TUI，不被 void 吞掉。
      submit(draft).catch((error) => {
        setBusy(false)
        addMessage("assistant", `⚠ 出错：${error instanceof Error ? error.message : String(error)}`)
      })
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
  const modelOptions: SelectOption<string>[] = modelChoices.map((m) => ({
    label: m.configured ? `${m.label} ✓` : `${m.label} ·未配置`,
    value: m.id,
  }))

  return (
    <Box flexDirection="column">
      <Header />
      <MessageView messages={messages} />
      {mode === "selecting-login" ? (
        <SelectPrompt message="选择登录方式：" options={loginOptions} onSelect={runLoginOption} />
      ) : mode === "selecting-model" ? (
        <SelectPrompt message="选择模型：" options={modelOptions} onSelect={selectModel} />
      ) : mode === "text-input" && pendingText !== null ? (
        <TextPrompt label={pendingText.label} onSubmit={onTextSubmit} onCancel={onTextCancel} />
      ) : busy ? (
        <StatusLine />
      ) : (
        <PromptLine value={draft} />
      )}
    </Box>
  )
}
