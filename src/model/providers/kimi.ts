import type { Credential } from "../credential"
import type { ModelProvider } from "../provider"
import type { ModelRequest, ModelResponse } from "../types"

export interface KimiProviderOptions {
  credential: Credential
  /** OpenAI 兼容端点，默认 Moonshot 官方地址。 */
  baseURL?: string
}

const DEFAULT_BASE_URL = "https://api.moonshot.cn/v1"

/**
 * Kimi / Moonshot provider。走标准 OpenAI 兼容的 chat/completions，鉴权是 API key。
 *
 * TODO(实现): 在 complete() 里把 ModelRequest 转成 chat/completions 请求体、
 *             附 credential.authHeaders()、POST {baseURL}/chat/completions，
 *             再把响应（含 tool_calls）翻译回 ModelResponse。
 */
export class KimiProvider implements ModelProvider {
  readonly id = "kimi"
  private readonly credential: Credential
  private readonly baseURL: string

  constructor(options: KimiProviderOptions) {
    this.credential = options.credential
    this.baseURL = options.baseURL ?? DEFAULT_BASE_URL
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    void this.credential
    void this.baseURL
    throw new Error(`KimiProvider.complete 尚未实现（model=${request.model}）`)
  }
}
