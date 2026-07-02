import { describe, expect, test } from "bun:test"
import { sseEvents } from "../src/model/sse"

/** 把字符串按给定分块切成一个 ReadableStream，模拟网络分片（含多字节字符跨界）。 */
function streamOf(text: string, chunkSize: number): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text)
  let offset = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close()
        return
      }
      controller.enqueue(bytes.slice(offset, offset + chunkSize))
      offset += chunkSize
    },
  })
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const out: string[] = []
  for await (const payload of sseEvents(stream)) out.push(payload)
  return out
}

describe("sseEvents", () => {
  test("拆出 data payload，跳过注释/其他字段与 [DONE]", async () => {
    const sse = [
      ": comment",
      "event: created",
      'data: {"a":1}',
      "",
      'data: {"b":2}',
      "",
      "data: [DONE]",
      "",
    ].join("\n")
    expect(await collect(streamOf(sse, 1024))).toEqual(['{"a":1}', '{"b":2}'])
  })

  test("跨 chunk 边界与多字节字符不被截断（逐字节分片）", async () => {
    const sse = ['data: {"delta":"你好"}', "", 'data: {"delta":"世界"}', ""].join("\n")
    expect(await collect(streamOf(sse, 1))).toEqual(['{"delta":"你好"}', '{"delta":"世界"}'])
  })

  test("末尾无空行的最后一个事件也被产出", async () => {
    const sse = 'data: {"last":true}'
    expect(await collect(streamOf(sse, 3))).toEqual(['{"last":true}'])
  })
})
