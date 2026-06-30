import { render } from "ink"
import { App } from "./app"
import type { Responder } from "./responder"

export interface RunTuiOptions {
  responder: Responder
  greeting?: string
}

/**
 * 拉起界面层：渲染 App，返回一个在用户退出后 resolve 的 Promise。
 * 由 bootstrap（组合根）调用，自身不决定用哪个 responder。
 */
export async function runTui({ responder, greeting }: RunTuiOptions): Promise<void> {
  const element =
    greeting === undefined ? (
      <App responder={responder} />
    ) : (
      <App responder={responder} greeting={greeting} />
    )
  await render(element).waitUntilExit()
}
