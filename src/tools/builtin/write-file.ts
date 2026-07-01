import { mkdir, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, resolve } from "node:path"
import { z } from "zod"
import type { Tool } from "../tool"

const parameters = z.object({
  path: z.string().describe("要写入的文件路径（相对 cwd 或绝对）"),
  content: z.string().describe("写入的完整内容（覆盖原文件）"),
})

/** 写入文本文件（覆盖）。父目录不存在则自动创建。危险操作——应经权限层确认。 */
export const writeFileTool: Tool<z.infer<typeof parameters>> = {
  name: "write_file",
  description: "把内容写入一个文件（覆盖已存在的内容）",
  parameters,
  async execute({ path, content }, ctx) {
    const abs = isAbsolute(path) ? path : resolve(ctx.cwd, path)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, content, "utf8")
    return { output: `已写入 ${abs}（${content.length} 字符）` }
  },
}
