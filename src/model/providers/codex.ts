import type { Credential } from "../credential"
import type { ModelProvider } from "../provider"
import type { ModelRequest, ModelResponse } from "../types"
import { CODEX_RESPONSES_ENDPOINT, ORIGINATOR, USER_AGENT } from "./codex-oauth"

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
 * 从 Responses 的 SSE 负载里抽取助手文本：累加所有 response.output_text.delta。
 * 纯函数，方便测试；不处理工具调用（text-first）。
 */
export function extractResponseText(sse: string): string {
  let text = ""
  for (const line of sse.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed.startsWith("data:")) continue
    const payload = trimmed.slice("data:".length).trim()
    if (payload.length === 0 || payload === "[DONE]") continue
    let event: { type?: string; delta?: string }
    try {
      event = JSON.parse(payload) as { type?: string; delta?: string }
    } catch {
      continue
    }
    if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
      text += event.delta
    }
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

  async complete(request: ModelRequest): Promise<ModelResponse> {
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
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      throw new Error(`Codex 请求失败: ${res.status} ${detail}`.trim())
    }
    const sse = await res.text()
    return { type: "text", text: extractResponseText(sse) }
  }
}
