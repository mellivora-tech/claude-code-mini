import { zodToJsonSchema } from "zod-to-json-schema"
import type { ToolCall, ToolDefinition } from "../model/types"
import type { Tool, ToolContext, ToolResult } from "./tool"

/**
 * 工具管理：登记有哪些工具，向模型层暴露它们的 schema，并按名字执行调用。
 * 对标 model 层的 ModelRegistry —— 纯查表 + 分发，MCP 扩展层未来往这里 register 即可。
 */
export class ToolRegistry {
  private readonly tools = new Map<string, Tool>()

  register(tool: Tool): void {
    this.tools.set(tool.name, tool)
  }

  /** 暴露给模型的工具声明：zod 参数 → JSON Schema。 */
  definitions(): ToolDefinition[] {
    return [...this.tools.values()].map((t) => ({
      name: t.name,
      description: t.description,
      parameters: zodToJsonSchema(t.parameters) as Record<string, unknown>,
    }))
  }

  /**
   * 执行一次工具调用：先校验参数（失败不抛，回一条 isError 结果让模型自纠），
   * 再交给工具执行；工具自身抛错也兜成 isError，不冒泡打断编排循环。
   */
  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(call.name)
    if (tool === undefined) {
      return { output: `未知工具: ${call.name}`, isError: true }
    }
    const parsed = tool.parameters.safeParse(call.arguments)
    if (!parsed.success) {
      return { output: `参数校验失败: ${parsed.error.message}`, isError: true }
    }
    try {
      return await tool.execute(parsed.data, ctx)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      return { output: `工具执行出错: ${detail}`, isError: true }
    }
  }
}
