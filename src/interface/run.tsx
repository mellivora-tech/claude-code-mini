import { render } from "ink"
import type { AppProps } from "./app"
import { App } from "./app"
import type { LoginService } from "./login"
import type { ModelController } from "./model"
import type { Responder } from "./responder"

export interface RunTuiOptions {
  responder: Responder
  greeting?: string
  login?: LoginService
  models?: ModelController
}

/**
 * 拉起界面层：渲染 App，返回一个在用户退出后 resolve 的 Promise。
 * 由 bootstrap（组合根）调用，自身不决定用哪个 responder / login。
 */
export async function runTui({ responder, greeting, login, models }: RunTuiOptions): Promise<void> {
  // exactOptionalPropertyTypes 下不能显式传 undefined 给可选属性，故按需装配 props。
  const props: AppProps = { responder }
  if (greeting !== undefined) props.greeting = greeting
  if (login !== undefined) props.login = login
  if (models !== undefined) props.models = models
  await render(<App {...props} />).waitUntilExit()
}
