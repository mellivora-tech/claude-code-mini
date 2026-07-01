import { render } from "ink"
import type { AppProps } from "./app"
import { App } from "./app"
import type { Command } from "./command"
import type { Responder } from "./responder"

export interface RunTuiOptions {
  responder: Responder
  greeting?: string
  commands?: Command[]
}

/**
 * 拉起界面层：渲染 App，返回一个在用户退出后 resolve 的 Promise。
 * 由 bootstrap（组合根）调用，自身不决定 responder / 命令集。
 */
export async function runTui({ responder, greeting, commands }: RunTuiOptions): Promise<void> {
  // exactOptionalPropertyTypes 下不能显式传 undefined 给可选属性，故按需装配 props。
  const props: AppProps = { responder }
  if (greeting !== undefined) props.greeting = greeting
  if (commands !== undefined) props.commands = commands
  await render(<App {...props} />).waitUntilExit()
}
