import type { ModelRequest, ModelResponse } from "./types"

/**
 * 一个具体模型服务商的实现（如 codex / kimi）。
 *
 * 职责：把中立的 ModelRequest 翻译成自家线格式、附上鉴权、发请求，
 * 再把响应翻译回中立的 ModelResponse。鉴权细节藏在 Credential 里，
 * provider 不关心"订阅还是 API key"。
 */
export interface ModelProvider {
  /** provider 标识，与 ModelInfo.provider、Router 配置对应，如 "codex" / "kimi"。 */
  readonly id: string
  complete(request: ModelRequest): Promise<ModelResponse>
  /** 是否已具备凭证（轻量、不发网络）。缺省视为已配置。 */
  isConfigured?(): Promise<boolean>
}
