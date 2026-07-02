import { describe, expect, test } from "bun:test"
import { buildChatBody, createChatAccumulator } from "../src/model/providers/kimi"

describe("kimi buildChatBody", () => {
  test("角色/内容一一映射，流式", () => {
    const body = buildChatBody({
      model: "kimi-for-coding",
      messages: [
        { role: "system", content: "s" },
        { role: "user", content: "u" },
      ],
    })
    expect(body).toEqual({
      model: "kimi-for-coding",
      stream: true,
      messages: [
        { role: "system", content: "s" },
        { role: "user", content: "u" },
      ],
    })
  })

  test("工具定义翻成 function tools", () => {
    const body = buildChatBody({
      model: "kimi-for-coding",
      messages: [{ role: "user", content: "读文件" }],
      tools: [{ name: "read_file", description: "读取文件", parameters: { type: "object" } }],
    })
    expect(body.tools).toEqual([
      {
        type: "function",
        function: { name: "read_file", description: "读取文件", parameters: { type: "object" } },
      },
    ])
  })

  test("assistant.toolCalls 与 tool 结果翻成线格式", () => {
    const body = buildChatBody({
      model: "kimi-for-coding",
      messages: [
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "c1", name: "read_file", arguments: { path: "a.txt" } }],
        },
        { role: "tool", content: "文件内容", toolCallId: "c1" },
      ],
    })
    expect(body.messages).toEqual([
      {
        role: "assistant",
        content: "",
        tool_calls: [
          {
            id: "c1",
            type: "function",
            function: { name: "read_file", arguments: '{"path":"a.txt"}' },
          },
        ],
      },
      { role: "tool", content: "文件内容", tool_call_id: "c1" },
    ])
  })
})

describe("kimi createChatAccumulator", () => {
  test("累加文本增量，末尾装配 text 响应", () => {
    const acc = createChatAccumulator()
    expect(acc.push('{"choices":[{"delta":{"content":"你好"}}]}')).toBe("你好")
    expect(acc.push('{"choices":[{"delta":{"content":"，世界"}}]}')).toBe("，世界")
    expect(acc.result()).toEqual({ type: "text", text: "你好，世界" })
  })

  test("按 index 攒工具碎片，末尾装配 tool_calls", () => {
    const acc = createChatAccumulator()
    // 首片给 id+name，后续片续 arguments 字符串。
    acc.push(
      '{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"read_file","arguments":"{\\"pa"}}]}}]}',
    )
    acc.push(
      '{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"th\\":\\"a.txt\\"}"}}]}}]}',
    )
    expect(acc.result()).toEqual({
      type: "tool_calls",
      calls: [{ id: "c1", name: "read_file", arguments: { path: "a.txt" } }],
    })
  })

  test("工具碎片期间无文本吐出", () => {
    const acc = createChatAccumulator()
    const emitted = acc.push(
      '{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"x","arguments":"{}"}}]}}]}',
    )
    expect(emitted).toBe("")
  })
})
