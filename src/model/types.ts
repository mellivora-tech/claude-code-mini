/**
 * 模型层内部契约（provider 无关的"通用语"）。
 *
 * 每个 provider 负责把这些中立类型翻译成各自的线格式（OpenAI chat/completions、
 * ChatGPT 后端等）。上层（agent）只认这套类型，因此新增 provider 不影响别处。
 */

export type ModelRole = "system" | "user" | "assistant" | "tool"

/** 一条对话消息。比 interface 层的纯文本 Message 更"厚"，后续接 tools 层再扩展工具字段。 */
export interface ModelMessage {
  role: ModelRole
  content: string
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
}

/** 一次模型调用的输出：文本 或 一/多个工具调用请求（判别联合）。 */
export type ModelResponse =
  | { type: "text"; text: string }
  | { type: "tool_calls"; calls: ToolCall[] }
