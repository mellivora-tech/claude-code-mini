import { readdir, readFile, stat } from "node:fs/promises"
import { isAbsolute, join, relative, resolve } from "node:path"
import { z } from "zod"
import type { Tool } from "../tool"

const MAX_MATCHES = 200
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build"])

const parameters = z.object({
  pattern: z.string().describe("正则表达式（JS 语法），逐行匹配"),
  path: z.string().optional().describe("搜索起点目录，默认 cwd"),
})

/** 在目录树下逐行正则搜索，返回 `相对路径:行号: 内容`。自实现，不依赖系统 grep。 */
export const grepTool: Tool<z.infer<typeof parameters>> = {
  name: "grep",
  description: "在文件树中按正则逐行搜索文本",
  parameters,
  async execute({ pattern, path }, ctx) {
    let regex: RegExp
    try {
      regex = new RegExp(pattern)
    } catch (error) {
      return {
        output: `非法正则: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      }
    }
    const root = path === undefined ? ctx.cwd : isAbsolute(path) ? path : resolve(ctx.cwd, path)
    const matches: string[] = []
    await walk(root, root, regex, matches, ctx.signal)
    if (matches.length === 0) return { output: "（无匹配）" }
    const capped =
      matches.length >= MAX_MATCHES ? [...matches, `…（超过 ${MAX_MATCHES} 条，已截断）`] : matches
    return { output: capped.join("\n") }
  },
}

async function walk(
  root: string,
  dir: string,
  regex: RegExp,
  matches: string[],
  signal?: AbortSignal,
): Promise<void> {
  if (matches.length >= MAX_MATCHES || signal?.aborted === true) return
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (matches.length >= MAX_MATCHES) return
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      await walk(root, full, regex, matches, signal)
    } else if (entry.isFile()) {
      await searchFile(root, full, regex, matches)
    }
  }
}

async function searchFile(
  root: string,
  file: string,
  regex: RegExp,
  matches: string[],
): Promise<void> {
  const info = await stat(file).catch(() => null)
  if (info === null || info.size > 1_000_000) return // 跳过超大/二进制候选
  const content = await readFile(file, "utf8").catch(() => null)
  if (content === null) return
  const rel = relative(root, file)
  const lines = content.split("\n")
  for (let i = 0; i < lines.length; i++) {
    if (matches.length >= MAX_MATCHES) return
    const line = lines[i] ?? ""
    if (regex.test(line)) matches.push(`${rel}:${i + 1}: ${line.trim()}`)
  }
}
