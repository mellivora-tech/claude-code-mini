import { readFile } from "node:fs/promises"
import { isAbsolute, resolve } from "node:path"
import { z } from "zod"
import type { Tool } from "../tool"

const MAX_BYTES = 64_000

const parameters = z.object({
  path: z.string().describe("要读取的文件路径（相对 cwd 或绝对）"),
})

/** 读取文本文件内容。相对路径按 ctx.cwd 解析；超长截断以保护上下文窗口。 */
export const readFileTool: Tool<z.infer<typeof parameters>> = {
  name: "read_file",
  description: "读取一个文本文件的内容",
  parameters,
  async execute({ path }, ctx) {
    const abs = isAbsolute(path) ? path : resolve(ctx.cwd, path)
    const content = await readFile(abs, "utf8")
    if (content.length > MAX_BYTES) {
      return { output: `${content.slice(0, MAX_BYTES)}\n…（已截断，共 ${content.length} 字符）` }
    }
    return { output: content }
  },
}
