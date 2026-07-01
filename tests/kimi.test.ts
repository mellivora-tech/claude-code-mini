import { describe, expect, test } from "bun:test"
import { buildChatBody } from "../src/model/providers/kimi"

describe("kimi buildChatBody", () => {
  test("角色/内容一一映射，非流式", () => {
    const body = buildChatBody({
      model: "kimi-for-coding",
      messages: [
        { role: "system", content: "s" },
        { role: "user", content: "u" },
      ],
    })
    expect(body).toEqual({
      model: "kimi-for-coding",
      stream: false,
      messages: [
        { role: "system", content: "s" },
        { role: "user", content: "u" },
      ],
    })
  })
})
