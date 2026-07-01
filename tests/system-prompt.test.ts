import { describe, expect, test } from "bun:test"
import { buildSystemPrompt } from "../src/prompt/system"

describe("buildSystemPrompt", () => {
  test("包含被告知的模型 id 与项目名", () => {
    const prompt = buildSystemPrompt("gpt-5.4")
    expect(prompt).toContain("gpt-5.4")
    expect(prompt).toContain("claude-code-mini")
  })

  test("不同模型 id 反映在提示词里", () => {
    expect(buildSystemPrompt("kimi-k2")).toContain("kimi-k2")
  })
})
