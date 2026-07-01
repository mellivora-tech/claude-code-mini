import type { ModelRequest, ModelStreamEvent } from "./types"

/**
 * 一个具体模型服务商的实现（如 codex / kimi）。
 *
 * 职责：把中立的 ModelRequest 翻译成自家线格式、附上鉴权、发请求，
 * 再把流式响应翻译回中立的 ModelStreamEvent。鉴权细节藏在 Credential 里，
 * provider 不关心"订阅还是 API key"。
 *
 * 流式是唯一原语：provider 边收 SSE 边 yield text_delta，末尾 yield 一个
 * done（携带装配好的完整响应）。工具调用碎片的拼装留在 provider 内部，不外泄。
 * 需要一次性结果的调用者走 ModelService.complete（它 drain 这个流）。
 */
export interface ModelProvider {
  /** provider 标识，与 ModelInfo.provider、Router 配置对应，如 "codex" / "kimi"。 */
  readonly id: string
  stream(request: ModelRequest): AsyncIterable<ModelStreamEvent>
  /** 是否已具备凭证（轻量、不发网络）。缺省视为已配置。 */
  isConfigured?(): Promise<boolean>
}
