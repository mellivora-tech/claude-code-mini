import { describe, expect, test } from "bun:test"
import { z } from "zod"
import type { QueryEvent } from "../src/agent/events"
import { type QueryDeps, query, type StreamingModel } from "../src/agent/query"
import type {
  ModelMessage,
  ModelRequest,
  ModelResponse,
  ModelStreamEvent,
} from "../src/model/types"
import { allowAllGate, createPermissionGate } from "../src/permission/gate"
import { ToolRegistry } from "../src/tools/registry"
import type { Tool } from "../src/tools/tool"

/** 按脚本逐轮返回预设响应的假模型：每次 stream 调用消费脚本里的下一个响应。 */
function scriptedModel(responses: ModelResponse[]): StreamingModel {
  let i = 0
  return {
    async *stream(_request: ModelRequest): AsyncGenerator<ModelStreamEvent> {
      const response = responses[i++] ?? { type: "text", text: "" }
      if (response.type === "text") yield { type: "text_delta", text: response.text }
      yield { type: "done", response }
    },
  }
}

const echoArgsTool: Tool<{ v: string }> = {
  name: "echo",
  description: "回显参数",
  parameters: z.object({ v: z.string() }),
  async execute({ v }) {
    return { output: `tool:${v}` }
  },
}

function deps(model: StreamingModel, tools: ToolRegistry, permission = allowAllGate()): QueryDeps {
  return { model, tools, permission, modelId: "m" }
}

async function collect(gen: AsyncGenerator<QueryEvent>): Promise<QueryEvent[]> {
  const out: QueryEvent[] = []
  for await (const ev of gen) out.push(ev)
  return out
}

describe("query 单轮循环", () => {
  test("纯文本响应：吐 text_delta + assistant + done(stop)，写回历史", async () => {
    const messages: ModelMessage[] = [{ role: "user", content: "hi" }]
    const events = await collect(
      query(messages, deps(scriptedModel([{ type: "text", text: "你好" }]), new ToolRegistry()), {
        cwd: ".",
      }),
    )
    expect(events).toEqual([
      { type: "text_delta", text: "你好" },
      { type: "assistant", content: "你好" },
      { type: "done", reason: "stop" },
    ])
    expect(messages.at(-1)).toEqual({ role: "assistant", content: "你好" })
  })

  test("工具调用：执行并回填后，再问模型直到文本终止", async () => {
    const tools = new ToolRegistry()
    tools.register(echoArgsTool)
    const model = scriptedModel([
      { type: "tool_calls", calls: [{ id: "c1", name: "echo", arguments: { v: "x" } }] },
      { type: "text", text: "完成" },
    ])
    const messages: ModelMessage[] = [{ role: "user", content: "跑工具" }]
    const events = await collect(query(messages, deps(model, tools), { cwd: "." }))

    const types = events.map((e) => e.type)
    expect(types).toEqual([
      "assistant",
      "tool_start",
      "tool_result",
      "text_delta",
      "assistant",
      "done",
    ])
    const result = events.find((e) => e.type === "tool_result")
    expect(result).toMatchObject({ output: "tool:x", isError: false })
    // 历史应含 assistant(toolCalls) + tool 结果 + 最终 assistant。
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "tool", "assistant"])
    expect(messages[2]).toMatchObject({ role: "tool", toolCallId: "c1", content: "tool:x" })
  })

  test("被拒的工具回填拒绝信息，循环继续", async () => {
    const tools = new ToolRegistry()
    tools.register(echoArgsTool)
    const model = scriptedModel([
      { type: "tool_calls", calls: [{ id: "c1", name: "echo", arguments: { v: "x" } }] },
      { type: "text", text: "ok" },
    ])
    // confirm 恒 false → echo 非白名单 → 拒绝。
    const gate = createPermissionGate(async () => false)
    const events = await collect(
      query([{ role: "user", content: "q" }], deps(model, tools, gate), { cwd: "." }),
    )
    const result = events.find((e) => e.type === "tool_result")
    expect(result).toMatchObject({ isError: true })
    expect((result as { output: string }).output).toContain("拒绝")
  })

  test("maxSteps 兜底：模型不停请求工具时以 max_steps 终止", async () => {
    const tools = new ToolRegistry()
    tools.register(echoArgsTool)
    // 永远返回 tool_calls 的模型。
    const model: StreamingModel = {
      async *stream() {
        yield {
          type: "done",
          response: {
            type: "tool_calls",
            calls: [{ id: "c", name: "echo", arguments: { v: "a" } }],
          },
        }
      },
    }
    const d: QueryDeps = { model, tools, permission: allowAllGate(), modelId: "m", maxSteps: 3 }
    const events = await collect(query([{ role: "user", content: "q" }], d, { cwd: "." }))
    expect(events.at(-1)).toEqual({ type: "done", reason: "max_steps" })
  })

  test("已中断：进入即 done(aborted)", async () => {
    const ac = new AbortController()
    ac.abort()
    const events = await collect(
      query(
        [{ role: "user", content: "q" }],
        deps(scriptedModel([{ type: "text", text: "x" }]), new ToolRegistry()),
        {
          cwd: ".",
          signal: ac.signal,
        },
      ),
    )
    expect(events).toEqual([{ type: "done", reason: "aborted" }])
  })
})
