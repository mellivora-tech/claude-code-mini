import { describe, expect, test } from "bun:test"
import { render } from "ink-testing-library"
import type { QueryEvent } from "../src/agent/events"
import { App } from "../src/interface/app"
import type { Responder } from "../src/interface/responder"

const ENTER = "\r"
const tick = (ms = 20) => new Promise((resolve) => setTimeout(resolve, ms))

/** 吐固定事件序列的假 responder。 */
function fakeResponder(events: QueryEvent[]): Responder {
  return {
    async *send() {
      for (const ev of events) {
        await tick(1)
        yield ev
      }
    },
    interrupt() {},
  }
}

async function type(stdin: { write: (s: string) => void }, text: string) {
  stdin.write(text)
  await tick(5)
  stdin.write(ENTER)
  await tick(40)
}

describe("App 事件流渲染", () => {
  test("text_delta 累积成助手气泡", async () => {
    const responder = fakeResponder([
      { type: "text_delta", text: "你好" },
      { type: "text_delta", text: "，世界" },
      { type: "done", reason: "stop" },
    ])
    const { stdin, lastFrame } = render(<App responder={responder} />)
    await type(stdin, "hi")
    expect(lastFrame()).toContain("你好，世界")
  })

  test("工具调用渲染状态行 + 结果标记", async () => {
    const responder = fakeResponder([
      {
        type: "assistant",
        content: "",
        toolCalls: [{ id: "c1", name: "read_file", arguments: {} }],
      },
      { type: "tool_start", call: { id: "c1", name: "read_file", arguments: {} } },
      { type: "tool_result", callId: "c1", output: "文件内容", isError: false },
      { type: "text_delta", text: "读完了" },
      { type: "done", reason: "stop" },
    ])
    const { stdin, lastFrame } = render(<App responder={responder} />)
    await type(stdin, "读文件")
    const frame = lastFrame() ?? ""
    expect(frame).toContain("✓")
    expect(frame).toContain("文件内容")
    expect(frame).toContain("读完了")
  })

  test("done(error) 渲染错误提示", async () => {
    const responder = fakeResponder([{ type: "done", reason: "error", message: "网络挂了" }])
    const { stdin, lastFrame } = render(<App responder={responder} />)
    await type(stdin, "q")
    expect(lastFrame()).toContain("网络挂了")
  })
})
