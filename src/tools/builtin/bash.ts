import { spawn } from "node:child_process"
import { z } from "zod"
import type { Tool, ToolContext, ToolResult } from "../tool"

const DEFAULT_TIMEOUT_MS = 120_000
const MAX_OUTPUT = 64_000

const parameters = z.object({
  command: z.string().describe("要在 shell 中执行的命令"),
})

/** 执行一条 shell 命令，返回合并的 stdout+stderr。危险操作——应经权限层确认。 */
export const bashTool: Tool<z.infer<typeof parameters>> = {
  name: "bash",
  description: "在 shell 中执行一条命令并返回输出",
  parameters,
  execute({ command }, ctx) {
    return runCommand(command, ctx)
  },
}

function runCommand(command: string, ctx: ToolContext): Promise<ToolResult> {
  return new Promise((resolvePromise) => {
    const child = spawn(command, {
      cwd: ctx.cwd,
      shell: true,
      signal: ctx.signal,
    })
    let out = ""
    const append = (chunk: Buffer) => {
      if (out.length < MAX_OUTPUT) out += chunk.toString("utf8")
    }
    child.stdout.on("data", append)
    child.stderr.on("data", append)

    const timer = setTimeout(() => child.kill("SIGKILL"), DEFAULT_TIMEOUT_MS)

    child.on("error", (error) => {
      clearTimeout(timer)
      resolvePromise({ output: `无法执行命令: ${error.message}`, isError: true })
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      const trimmed = out.length > MAX_OUTPUT ? `${out.slice(0, MAX_OUTPUT)}\n…（输出已截断）` : out
      const body = trimmed.length > 0 ? trimmed : "（无输出）"
      resolvePromise(
        code === 0 ? { output: body } : { output: `退出码 ${code}\n${body}`, isError: true },
      )
    })
  })
}
