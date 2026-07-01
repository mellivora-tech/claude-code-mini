import { buildCli } from "./cli"
import type { LoginOption, LoginService } from "./interface/login"
import type { ModelController } from "./interface/model"
import type { SelectOption } from "./interface/prompt"
import { promptSelect } from "./interface/prompt"
import type { Responder } from "./interface/responder"
import { runTui } from "./interface/run"
import { AuthStore } from "./model/auth-store"
import type { ModelMessage } from "./model/index"
import { createModelService } from "./model/index"
import type { CodexLoginMethod } from "./model/providers/codex-oauth"
import { loginCodex } from "./model/providers/codex-oauth"
import { buildSystemPrompt } from "./prompt/system"

const DEFAULT_GREETING =
  "欢迎使用 claude-code-mini。/login 登录 Codex 订阅，/model 切换模型，然后即可对话。"

/**
 * 启动类 / 组合根（composition root）。
 *
 * 命令解析委托给 cli.ts（commander）；登录逻辑（model 层）包装成 LoginService；
 * 聊天把 model 层 + prompt 层组合成 Responder，并暴露 ModelController 供 /model 切换。
 */
export class Bootstrap {
  private readonly store = new AuthStore()

  async run(argv: readonly string[] = process.argv): Promise<void> {
    await buildCli({
      login: (provider, device) => this.runLogin(provider, device),
      runTui: () => this.launchTui(),
    }).parseAsync([...argv])
  }

  private async launchTui(): Promise<void> {
    const chat = this.createChat()
    await runTui({
      responder: chat.responder,
      greeting: DEFAULT_GREETING,
      login: this.loginService(),
      models: chat.models,
    })
  }

  /**
   * 组合 model + prompt 层成一次对话能力：
   *   - responder：注入 system prompt（当前模型）+ 历史 + 输入 → 调当前模型
   *   - models：列出/切换当前模型（与 responder 共享同一个 current）
   */
  private createChat(): { responder: Responder; models: ModelController } {
    const service = createModelService()
    const catalog = service.models()
    let current = catalog[0]?.id ?? "gpt-5.4"

    const responder: Responder = {
      respond: async (input, history) => {
        const messages: ModelMessage[] = [
          { role: "system", content: buildSystemPrompt(current) },
          ...history.map((m): ModelMessage => ({ role: m.role, content: m.content })),
          { role: "user", content: input },
        ]
        const result = await service.complete({ model: current, messages })
        return result.type === "text" ? result.text : "（模型请求了工具调用，工具层尚未接入）"
      },
    }

    const models: ModelController = {
      list: () => service.models().map((m) => ({ id: m.id, label: `${m.id}（${m.provider}）` })),
      current: () => current,
      select: (id) => {
        current = id
      },
    }

    return { responder, models }
  }

  /** 把 model 层的登录逻辑包装成界面无关的 LoginService。 */
  private loginService(): LoginService {
    return {
      options: [
        this.loginOption("browser", "openai-auth · 浏览器登录（Codex / ChatGPT 订阅）"),
        this.loginOption("device", "openai-auth · 设备码登录（headless）"),
      ],
    }
  }

  private loginOption(method: CodexLoginMethod, label: string): LoginOption {
    return {
      label,
      run: async (onInfo) => {
        const tokens = await loginCodex(this.store, method, onInfo)
        const account = tokens.accountId === undefined ? "" : `（account: ${tokens.accountId}）`
        return `登录成功${account}。凭证已保存。`
      },
    }
  }

  /** CLI 层登录：无 provider 时交互式选择，否则按 --device 直接选流程。 */
  private async runLogin(provider: string | undefined, device: boolean): Promise<void> {
    let option: LoginOption
    if (provider === undefined) {
      const options: SelectOption<LoginOption>[] = this.loginService().options.map((o) => ({
        label: o.label,
        value: o,
      }))
      option = await promptSelect("选择登录方式：", options)
    } else {
      if (provider !== "openai" && provider !== "codex") {
        throw new Error(`暂不支持登录: ${provider}（目前仅 openai-auth）`)
      }
      option = this.loginOption(device ? "device" : "browser", "openai-auth")
    }
    const message = await option.run((info) => {
      console.log(info)
    })
    console.log(message)
  }
}
