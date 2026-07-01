import { describe, expect, test } from "bun:test"
import { z } from "zod"
import { readFileTool } from "../src/tools/builtin/read-file"
import { ToolRegistry } from "../src/tools/registry"
import type { Tool } from "../src/tools/tool"

const echoTool: Tool<{ msg: string }> = {
  name: "echo",
  description: "回显",
  parameters: z.object({ msg: z.string() }),
  async execute({ msg }) {
    return { output: msg }
  },
}

describe("ToolRegistry", () => {
  test("definitions 暴露 name/description + JSON Schema 参数", () => {
    const reg = new ToolRegistry()
    reg.register(echoTool)
    const defs = reg.definitions()
    expect(defs).toHaveLength(1)
    expect(defs[0]?.name).toBe("echo")
    expect(defs[0]?.description).toBe("回显")
    // zodToJsonSchema 产出对象类型 schema，含 properties.msg。
    const params = defs[0]?.parameters as { properties?: { msg?: unknown } }
    expect(params.properties?.msg).toBeDefined()
  })

  test("execute 分发到对应工具", async () => {
    const reg = new ToolRegistry()
    reg.register(echoTool)
    const res = await reg.execute({ id: "1", name: "echo", arguments: { msg: "hi" } }, { cwd: "." })
    expect(res).toEqual({ output: "hi" })
  })

  test("未知工具回 isError，不抛", async () => {
    const reg = new ToolRegistry()
    const res = await reg.execute({ id: "1", name: "nope", arguments: {} }, { cwd: "." })
    expect(res.isError).toBe(true)
    expect(res.output).toContain("未知工具")
  })

  test("参数校验失败回 isError，不抛", async () => {
    const reg = new ToolRegistry()
    reg.register(echoTool)
    const res = await reg.execute({ id: "1", name: "echo", arguments: { msg: 123 } }, { cwd: "." })
    expect(res.isError).toBe(true)
    expect(res.output).toContain("参数校验失败")
  })

  test("工具抛错被兜成 isError", async () => {
    const reg = new ToolRegistry()
    reg.register({
      name: "boom",
      description: "总是抛错",
      parameters: z.object({}),
      async execute() {
        throw new Error("炸了")
      },
    })
    const res = await reg.execute({ id: "1", name: "boom", arguments: {} }, { cwd: "." })
    expect(res.isError).toBe(true)
    expect(res.output).toContain("炸了")
  })

  test("read_file 读到真实文件内容", async () => {
    const reg = new ToolRegistry()
    reg.register(readFileTool)
    const res = await reg.execute(
      { id: "1", name: "read_file", arguments: { path: "package.json" } },
      { cwd: process.cwd() },
    )
    expect(res.isError).toBeUndefined()
    expect(res.output).toContain("claude-code-mini")
  })
})
