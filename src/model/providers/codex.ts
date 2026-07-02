import type { Credential } from "../credential"
import type { ModelProvider } from "../provider"
import { sseEvents } from "../sse"
import type { ModelRequest, ModelStreamEvent } from "../types"
import { USER_AGENT } from "../user-agent"
import { CODEX_RESPONSES_ENDPOINT, ORIGINATOR } from "./codex-oauth"

export interface CodexProviderOptions {
  credential: Credential
  /** ChatGPT 后端 Responses 端点（订阅登录态走这里，非标准 OpenAI API）。 */
  baseURL?: string
}

// Responses API 的 input 项（仅文本；工具/图片等后续再加）。
type ResponsesInputItem =
  | { role: "user"; content: { type: "input_text"; text: string }[] }
  | { role: "assistant"; content: { type: "output_text"; text: string }[] }

interface ResponsesBody {
  model: string
  input: ResponsesInputItem[]
  stream: boolean
  store: boolean
  instructions?: string
}

/**
 * 把中立的 ModelRequest 翻成 Responses 请求体：
 *   - system 合并进 instructions
 *   - user → input_text，assistant → output_text
 *   - tool 角色暂不支持（text-first），忽略
 */
export function buildResponsesBody(request: ModelRequest): ResponsesBody {
  const systemParts: string[] = []
  const input: ResponsesInputItem[] = []
  for (const message of request.messages) {
    if (message.role === "system") {
      systemParts.push(message.content)
    } else if (message.role === "assistant") {
      input.push({ role: "assistant", content: [{ type: "output_text", text: message.content }] })
    } else if (message.role === "user") {
      input.push({ role: "user", content: [{ type: "input_text", text: message.content }] })
    }
  }
  const body: ResponsesBody = { model: request.model, input, stream: true, store: false }
  if (systemParts.length > 0) body.instructions = systemParts.join("\n\n")
  return body
}

/**
 * 从单个 SSE data payload 里取出本片文本增量（response.output_text.delta）。
 * 非该事件或坏 JSON 返回空串。流式增量消费用；纯函数，便于测试。
 */
export function extractTextDelta(payload: string): string {
  let event: { type?: string; delta?: string }
  try {
    event = JSON.parse(payload) as { type?: string; delta?: string }
  } catch {
    return ""
  }
  if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
    return event.delta
  }
  return ""
}

/**
 * 从单个 SSE data payload 里取出本片思考增量（response.reasoning.delta 等）。
 * 不同后端字段名可能不同，这里列出常见几种做 fallback 探测。
 */
export function extractReasoningDelta(payload: string): string {
  let event: { type?: string; delta?: string; reasoning?: string; reasoning_content?: string }
  try {
    event = JSON.parse(payload) as { type?: string; delta?: string; reasoning?: string; reasoning_content?: string }
  } catch {
    return ""
  }
  if (event.type === "response.reasoning.delta" && typeof event.delta === "string") return event.delta
  if (typeof event.reasoning_content === "string") return event.reasoning_content
  if (typeof event.reasoning === "string") return event.reasoning
  return ""
}

/**
 * 从 Responses 的 SSE 负载里抽取助手文本：累加所有 response.output_text.delta。
 * 纯函数，方便测试；不处理工具调用（text-first）。整段缓冲版本，供非流式场景/测试。
 */
export function extractResponseText(sse: string): string {
  let text = ""
  for (const line of sse.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed.startsWith("data:")) continue
    const payload = trimmed.slice("data:".length).trim()
    if (payload.length === 0 || payload === "[DONE]") continue
    text += extractTextDelta(payload)
  }
  return text
}

/**
 * Codex provider：用 ChatGPT 订阅登录态调 Responses 后端。
 * 目前只支持文本（工具调用待接 tools 层）。
 *
 * 注意：端点/请求体/头都是逆向的，后端 400 时会把返回详情原样抛出，便于定位。
 */
export class CodexProvider implements ModelProvider {
  readonly id = "codex"
  private readonly credential: Credential
  private readonly baseURL: string

  constructor(options: CodexProviderOptions) {
    this.credential = options.credential
    this.baseURL = options.baseURL ?? CODEX_RESPONSES_ENDPOINT
  }

  async isConfigured(): Promise<boolean> {
    return (await this.credential.isConfigured?.()) ?? true
  }

  async *stream(request: ModelRequest): AsyncGenerator<ModelStreamEvent, void, unknown> {
    const authHeaders = await this.credential.authHeaders()
    const res = await fetch(this.baseURL, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        originator: ORIGINATOR,
        "User-Agent": USER_AGENT,
        "session-id": crypto.randomUUID(),
      },
      body: JSON.stringify(buildResponsesBody(request)),
      signal: request.signal ?? null,
    })
    if (!res.ok || res.body === null) {
      const detail = await res.text().catch(() => "")
      throw new Error(`Codex 请求失败: ${res.status} ${detail}`.trim())
    }
    let text = ""
    for await (const payload of sseEvents(res.body)) {
      const textDelta = extractTextDelta(payload)
      if (textDelta.length > 0) {
        text += textDelta
        yield { type: "text_delta", text: textDelta }
      }
      const reasoningDelta = extractReasoningDelta(payload)
      if (reasoningDelta.length > 0) {
        yield { type: "reasoning_delta", text: reasoningDelta }
      }
    }
    yield { type: "done", response: { type: "text", text } }
  }
}
