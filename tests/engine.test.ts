import { describe, expect, test } from "bun:test"
import { createMemoryStore, type EngineDeps, QueryEngine } from "../src/agent/engine"
import type { QueryEvent } from "../src/agent/events"
import type { ModelRequest, ModelStreamEvent, Usage } from "../src/model/types"
import { allowAllGate } from "../src/permission/gate"
import { ToolRegistry } from "../src/tools/registry"

/** 每轮回一段文本 + 指定用量的假模型。 */
function textModel(text: string, usage?: Usage): EngineDeps["model"] {
  return {
    async *stream(_request: ModelRequest): AsyncGenerator<ModelStreamEvent> {
      yield { type: "text_delta", text }
      yield usage === undefined
        ? { type: "done", response: { type: "text", text } }
        : { type: "done", response: { type: "text", text }, usage }
    },
  }
}

function baseDeps(model: EngineDeps["model"]): EngineDeps {
  return {
    model,
    tools: new ToolRegistry(),
    permission: allowAllGate(),
    system: (id) => `system for ${id}`,
    modelId: () => "m1",
  }
}

async function drain(gen: AsyncGenerator<QueryEvent>): Promise<QueryEvent[]> {
  const out: QueryEvent[] = []
  for await (const ev of gen) out.push(ev)
  return out
}

describe("QueryEngine 对话生命周期", () => {
  test("send 注入 system + user，跑一轮，结束后持久化", async () => {
    const store = createMemoryStore()
    const engine = new QueryEngine(baseDeps(textModel("你好")), store)
    const events = await drain(engine.send("hi", { cwd: "." }))

    expect(events.at(-1)).toEqual({ type: "done", reason: "stop" })
    const saved = store.last()
    expect(saved?.messages.map((m) => m.role)).toEqual(["system", "user", "assistant"])
    expect(saved?.messages[0]).toEqual({ role: "system", content: "system for m1" })
  })

  test("多轮：system 始终在首位且只有一条", async () => {
    const store = createMemoryStore()
    const engine = new QueryEngine(baseDeps(textModel("ok")), store)
    await drain(engine.send("一", { cwd: "." }))
    await drain(engine.send("二", { cwd: "." }))
    const roles = store.last()?.messages.map((m) => m.role)
    expect(roles).toEqual(["system", "user", "assistant", "user", "assistant"])
  })

  test("累计 usage 超预算 → 中断（done aborted）", async () => {
    const store = createMemoryStore()
    // 每轮报 60 输出 token；预算 50 → 首轮结束即超。
    const engine = new QueryEngine(
      baseDeps(textModel("x", { inputTokens: 0, outputTokens: 60 })),
      store,
      {
        maxOutputTokens: 50,
      },
    )
    const events = await drain(engine.send("q", { cwd: "." }))
    // usage 事件在 done(stop) 之前到达并触发 abort；本轮已产出 stop，但下一轮不会再开。
    expect(events.some((e) => e.type === "usage")).toBe(true)
    expect(engine.usage().outputTokens).toBe(60)
  })

  test("interrupt 在 send 前调用不炸；无进行中轮次时安全", () => {
    const engine = new QueryEngine(baseDeps(textModel("x")), createMemoryStore())
    expect(() => engine.interrupt()).not.toThrow()
  })
})
