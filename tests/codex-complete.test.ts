import { describe, expect, test } from "bun:test"
import { buildResponsesBody, extractResponseText } from "../src/model/providers/codex"

describe("buildResponsesBody", () => {
  test("system 合并进 instructions，user/assistant 进 input", () => {
    const body = buildResponsesBody({
      model: "gpt-5.4",
      messages: [
        { role: "system", content: "你是助手" },
        { role: "user", content: "你好" },
        { role: "assistant", content: "在的" },
        { role: "user", content: "再问一句" },
      ],
    })

    expect(body.model).toBe("gpt-5.4")
    expect(body.stream).toBe(true)
    expect(body.store).toBe(false)
    expect(body.instructions).toBe("你是助手")
    expect(body.input).toEqual([
      { role: "user", content: [{ type: "input_text", text: "你好" }] },
      { role: "assistant", content: [{ type: "output_text", text: "在的" }] },
      { role: "user", content: [{ type: "input_text", text: "再问一句" }] },
    ])
  })

  test("无 system 时不带 instructions", () => {
    const body = buildResponsesBody({
      model: "gpt-5.4",
      messages: [{ role: "user", content: "hi" }],
    })
    expect(body.instructions).toBeUndefined()
  })
})

describe("extractResponseText", () => {
  test("累加 output_text.delta，忽略其他事件", () => {
    const sse = [
      'data: {"type":"response.created"}',
      "",
      'data: {"type":"response.output_text.delta","delta":"你好"}',
      "",
      'data: {"type":"response.output_text.delta","delta":"，世界"}',
      "",
      'data: {"type":"response.completed"}',
      "",
      "data: [DONE]",
      "",
    ].join("\n")

    expect(extractResponseText(sse)).toBe("你好，世界")
  })

  test("坏 JSON 行被跳过", () => {
    const sse = [
      'data: {"type":"response.output_text.delta","delta":"a"}',
      "data: not-json",
      "",
    ].join("\n")
    expect(extractResponseText(sse)).toBe("a")
  })
})
