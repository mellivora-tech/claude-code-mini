import type { Message } from "./types"

/**
 * 界面层与模型层之间的契约。interface 只管收一条用户输入、拿回一段回复，
 * 不关心背后是 mock、真模型，还是完整的 agent loop。
 */
export interface Responder {
  respond(input: string, history: readonly Message[]): Promise<string>
}

/**
 * 占位响应器：模型层尚未实现时使用，回声 + 模拟思考延迟。
 * 接入真模型后替换为调用 agent loop 的实现即可。
 */
export function createEchoResponder(): Responder {
  return {
    async respond(input) {
      await delay(450)
      return [
        `（mock 回复）收到：「${input}」`,
        "目前还没接模型层，这是 interface 层的占位响应。",
      ].join("\n")
    },
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
