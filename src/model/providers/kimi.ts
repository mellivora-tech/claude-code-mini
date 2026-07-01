import type { Credential } from "../credential"
import type { ModelProvider } from "../provider"
import type { ModelRequest, ModelResponse } from "../types"
import { USER_AGENT } from "../user-agent"

export interface KimiProviderOptions {
  credential: Credential
  /** OpenAI 兼容端点，默认 Kimi Code（coding plan）地址。 */
  baseURL?: string
}

// Kimi Code（coding plan）的 OpenAI 兼容端点；通用 Moonshot 是 api.moonshot.cn/v1。
const DEFAULT_BASE_URL = "https://api.kimi.com/coding/v1"

interface ChatMessage {
  role: string
  content: string
}

interface ChatBody {
  model: string
  messages: ChatMessage[]
  stream: boolean
}

/** 把中立 ModelRequest 翻成 OpenAI chat/completions 请求体（角色/内容一一对应）。 */
export function buildChatBody(request: ModelRequest): ChatBody {
  return {
    model: request.model,
    messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
    stream: false,
  }
}

/**
 * Kimi / Moonshot provider：标准 OpenAI 兼容 chat/completions，鉴权是 API key。
 * 非流式：一次 POST 拿完整 JSON，取 choices[0].message.content。
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

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const authHeaders = await this.credential.authHeaders()
    const res = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json", "User-Agent": USER_AGENT },
      body: JSON.stringify(buildChatBody(request)),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      throw new Error(`Kimi 请求失败: ${res.status} ${detail}`.trim())
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    return { type: "text", text: data.choices?.[0]?.message?.content ?? "" }
  }
}
