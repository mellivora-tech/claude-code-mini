import type { Credential } from "../credential"
import type { ModelProvider } from "../provider"
import { sseEvents } from "../sse"
import type { ModelMessage, ModelRequest, ModelResponse, ModelStreamEvent } from "../types"
import { USER_AGENT } from "../user-agent"

export interface KimiProviderOptions {
  credential: Credential
  /** OpenAI 兼容端点，默认 Kimi Code（coding plan）地址。 */
  baseURL?: string
}

// Kimi Code（coding plan）的 OpenAI 兼容端点；通用 Moonshot 是 api.moonshot.cn/v1。
const DEFAULT_BASE_URL = "https://api.kimi.com/coding/v1"

// —— OpenAI chat/completions 线格式 ——
interface WireToolCall {
  id: string
  type: "function"
  function: { name: string; arguments: string }
}

interface WireMessage {
  role: string
  content: string
  tool_calls?: WireToolCall[]
  tool_call_id?: string
}

interface WireTool {
  type: "function"
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

interface ChatBody {
  model: string
  messages: WireMessage[]
  stream: boolean
  tools?: WireTool[]
}

/** 把一条中立 ModelMessage 翻成 chat/completions 线消息（含工具字段）。 */
function toWireMessage(m: ModelMessage): WireMessage {
  const wire: WireMessage = { role: m.role, content: m.content }
  if (m.toolCalls !== undefined && m.toolCalls.length > 0) {
    wire.tool_calls = m.toolCalls.map((c) => ({
      id: c.id,
      type: "function",
      function: { name: c.name, arguments: JSON.stringify(c.arguments) },
    }))
  }
  if (m.toolCallId !== undefined) wire.tool_call_id = m.toolCallId
  return wire
}

/** 把中立 ModelRequest 翻成 OpenAI chat/completions 请求体（角色/内容/工具映射，流式）。 */
export function buildChatBody(request: ModelRequest): ChatBody {
  const body: ChatBody = {
    model: request.model,
    messages: request.messages.map(toWireMessage),
    stream: true,
  }
  if (request.tools !== undefined && request.tools.length > 0) {
    body.tools = request.tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }))
  }
  return body
}

// —— 流式分片累加器 ——
// chat/completions 流式把工具调用拆成碎片：首片给 index+id+function.name，
// 后续片把 function.arguments 一段段续上。累加器按 index 攒，末尾装配成完整 ToolCall。
interface StreamChunk {
  choices?: {
    delta?: {
      content?: string
      tool_calls?: {
        index: number
        id?: string
        function?: { name?: string; arguments?: string }
      }[]
    }
  }[]
}

/** 累加一条流的文本与工具碎片，末尾产出装配好的 ModelResponse。碎片拼装不外泄。 */
export function createChatAccumulator() {
  let text = ""
  const tools = new Map<number, { id: string; name: string; args: string }>()

  return {
    /** 喂入一个 SSE data payload，返回本片应向界面吐出的文本增量（无则空串）。 */
    push(payload: string): string {
      let chunk: StreamChunk
      try {
        chunk = JSON.parse(payload) as StreamChunk
      } catch {
        return ""
      }
      const delta = chunk.choices?.[0]?.delta
      let emitted = ""
      if (typeof delta?.content === "string" && delta.content.length > 0) {
        text += delta.content
        emitted = delta.content
      }
      for (const tc of delta?.tool_calls ?? []) {
        const cur = tools.get(tc.index) ?? { id: "", name: "", args: "" }
        if (tc.id !== undefined) cur.id = tc.id
        if (tc.function?.name !== undefined) cur.name = tc.function.name
        if (tc.function?.arguments !== undefined) cur.args += tc.function.arguments
        tools.set(tc.index, cur)
      }
      return emitted
    },

    /** 装配最终响应：有工具碎片则为 tool_calls，否则为 text。 */
    result(): ModelResponse {
      if (tools.size === 0) return { type: "text", text }
      const calls = [...tools.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, c]) => ({ id: c.id, name: c.name, arguments: parseArgs(c.args) }))
      return { type: "tool_calls", calls }
    },
  }
}

/** 工具参数是流式拼出的 JSON 字符串；坏 JSON 兜底成空对象，交由上层校验报错。 */
function parseArgs(raw: string): Record<string, unknown> {
  if (raw.length === 0) return {}
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

/**
 * Kimi / Moonshot provider：标准 OpenAI 兼容 chat/completions，鉴权是 API key。
 * 流式：POST（stream:true）拿 SSE，逐片 yield text_delta；工具碎片在内部攒好，
 * 末尾 yield done（携带装配完整的 text 或 tool_calls 响应）。
 */
export class KimiProvider implements ModelProvider {
  readonly id = "kimi"
  private readonly credential: Credential
  private readonly baseURL: string

  constructor(options: KimiProviderOptions) {
    this.credential = options.credential
    this.baseURL = options.baseURL ?? DEFAULT_BASE_URL
  }

  async isConfigured(): Promise<boolean> {
    return (await this.credential.isConfigured?.()) ?? true
  }

  async *stream(request: ModelRequest): AsyncGenerator<ModelStreamEvent, void, unknown> {
    const authHeaders = await this.credential.authHeaders()
    const res = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify(buildChatBody(request)),
      signal: request.signal ?? null,
    })
    if (!res.ok || res.body === null) {
      const detail = await res.text().catch(() => "")
      throw new Error(`Kimi 请求失败: ${res.status} ${detail}`.trim())
    }
    const acc = createChatAccumulator()
    for await (const payload of sseEvents(res.body)) {
      const delta = acc.push(payload)
      if (delta.length > 0) yield { type: "text_delta", text: delta }
    }
    yield { type: "done", response: acc.result() }
  }
}
