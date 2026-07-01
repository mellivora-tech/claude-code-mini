import type { QueryEvent } from "../agent/events"
import type { ConfirmFn } from "../permission/gate"

export type { ConfirmFn } from "../permission/gate"

/**
 * 界面层与编排层之间的契约。interface 只管：递一条用户输入 + 一个"危险操作确认"回调，
 * 拿回一串事件流（打字机文本 / 工具状态 / 结束）。背后是 mock 还是完整 agent loop 它不关心。
 */
export interface Responder {
  /** 发起一轮对话。confirm 用于权限层弹确认（只读工具不会触发）。 */
  send(input: string, confirm: ConfirmFn): AsyncIterable<QueryEvent>
  /** 中断当前这一轮（Ctrl+C）。 */
  interrupt(): void
}

/**
 * 占位响应器：不接模型时用，把输入回声成流式事件（逐字 text_delta + done）。
 * 接入真 agent loop 后由 bootstrap 换成 QueryEngine 支撑的实现。
 */
export function createEchoResponder(): Responder {
  return {
    async *send(input) {
      const reply = `（mock 回复）收到：「${input}」`
      for (const ch of reply) {
        await delay(12)
        yield { type: "text_delta", text: ch }
      }
      yield { type: "done", reason: "stop" }
    },
    interrupt() {},
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
