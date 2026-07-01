/**
 * 共享 SSE（Server-Sent Events）解析。
 *
 * codex（Responses 后端）与 kimi（OpenAI chat/completions）都以 SSE 返回流式响应，
 * 本模块负责把 fetch 的字节流拆成一条条 `data:` payload，屏蔽两处细节：
 *   - UTF-8 解码需跨 chunk 边界（多字节字符可能被切断）
 *   - 事件以空行分隔，一个事件可能有多行 `data:`（按 SSE 规范拼接）
 *   - 跳过注释行与 `[DONE]` 哨兵
 * 产出的每个字符串是一个事件的 data 部分（仍是各家自己的 JSON，由 provider 再解析）。
 */

/** 把 fetch 响应体（ReadableStream）按 SSE 拆成 data payload 序列。 */
export async function* sseEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string, void, unknown> {
  const decoder = new TextDecoder()
  let buffer = ""
  const reader = body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      // stream: true 让多字节字符跨 chunk 时不被截断。
      buffer += decoder.decode(value, { stream: true })
      // SSE 事件以空行（\n\n）分隔；保留最后一段不完整的留到下次。
      let sep = buffer.indexOf("\n\n")
      while (sep !== -1) {
        const rawEvent = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)
        const payload = extractData(rawEvent)
        if (payload !== undefined) yield payload
        sep = buffer.indexOf("\n\n")
      }
    }
    // 收尾：flush 解码器 + 处理末尾可能残留的最后一个事件（无尾随空行）。
    buffer += decoder.decode()
    const payload = extractData(buffer)
    if (payload !== undefined) yield payload
  } finally {
    reader.releaseLock()
  }
}

/** 从一个 SSE 事件块里抽出并拼接 `data:` 行；无有效数据或为 [DONE] 时返回 undefined。 */
function extractData(rawEvent: string): string | undefined {
  const dataLines: string[] = []
  for (const line of rawEvent.split("\n")) {
    const trimmed = line.trimEnd()
    if (!trimmed.startsWith("data:")) continue // 注释（:）、event:、id: 等一律忽略
    dataLines.push(trimmed.slice("data:".length).replace(/^ /, ""))
  }
  if (dataLines.length === 0) return undefined
  const payload = dataLines.join("\n")
  if (payload.length === 0 || payload === "[DONE]") return undefined
  return payload
}
