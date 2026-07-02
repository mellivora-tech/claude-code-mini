/**
 * 模型层内部契约（provider 无关的"通用语"）。
 *
 * 每个 provider 负责把这些中立类型翻译成各自的线格式（OpenAI chat/completions、
 * ChatGPT 后端等）。上层（agent）只认这套类型，因此新增 provider 不影响别处。
 */

export type ModelRole = "system" | "user" | "assistant" | "tool"

/**
 * 一条对话消息。比 interface 层的纯文本 Message 更"厚"：
 *   - assistant 轮请求工具时带 toolCalls
 *   - tool 轮回填结果时带 toolCallId（指回是哪个 call 的结果）
 * provider 负责把这些字段翻成各自线格式。
 */
export interface ModelMessage {
  role: ModelRole
  content: string
  toolCalls?: ToolCall[]
  toolCallId?: string
}

/** 一个可用工具的声明。parameters 是 JSON Schema（由 zod 转换而来）。 */
export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

/** 模型决定调用某工具时产出的请求（模型只"请求"，执行在 tools 层）。 */
export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

/** 一次模型调用的输入：具体模型 id（由 router 决定）+ 历史 + 可用工具。 */
export interface ModelRequest {
  model: string
  messages: ModelMessage[]
  tools?: ToolDefinition[]
  /** 中断信号：透传到底层 fetch，abort 时取消在途请求。 */
  signal?: AbortSignal
}

/** 一次模型调用的输出：文本 或 一/多个工具调用请求（判别联合）。 */
export type ModelResponse =
  | { type: "text"; text: string }
  | { type: "tool_calls"; calls: ToolCall[] }

/** 一次调用的 token 用量（预算核算用）。 */
export interface Usage {
  inputTokens: number
  outputTokens: number
}

/**
 * 流式调用的中立事件。provider 边收边 yield：
 *   - text_delta —— 助手文本增量（直通界面做打字机）
 *   - done —— 流结束，携带装配好的完整 ModelResponse（工具调用碎片已在 provider 内拼好）
 * 判别联合，上层（query）只认这套，不碰各家 SSE 线格式。
 */
export type ModelStreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "done"; response: ModelResponse; usage?: Usage }
