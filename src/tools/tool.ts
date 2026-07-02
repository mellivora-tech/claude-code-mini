import type { ZodType } from "zod"

/**
 * 02 · 工具层 —— 模型唯一能"伸手"碰真实世界的接口。
 *
 * 一个 Tool 声明自己的名字、用途、参数（zod schema），并实现 execute。
 * 模型只产出「调用请求」（ToolCall），真正的副作用发生在 execute 里。
 * 参数用 zod 而非裸 JSON Schema：既能 zodToJsonSchema 喂给模型，又能在
 * execute 前 parse 校验、拿到类型安全的入参（见 registry）。
 */

/** 工具执行的运行时上下文（由编排层注入）。 */
export interface ToolContext {
  /** 工作目录，文件类工具据此解析相对路径。 */
  cwd: string
  /** 中断信号：长任务（bash）应在此 abort 时尽快停。 */
  signal?: AbortSignal
}

/** 工具执行结果。output 会作为 tool 消息回填给模型；isError 提示模型"这步失败了"。 */
export interface ToolResult {
  output: string
  isError?: boolean
}

/** 一个工具的声明 + 实现。A 为参数类型，由 parameters（zod）推导。 */
export interface Tool<A = unknown> {
  readonly name: string
  readonly description: string
  readonly parameters: ZodType<A>
  execute(args: A, ctx: ToolContext): Promise<ToolResult>
}
