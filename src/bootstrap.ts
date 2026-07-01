import { createInterface } from "node:readline/promises"
import { buildCli } from "./cli"
import type { LoginContext, LoginOption, LoginService } from "./interface/login"
import type { ModelChoice, ModelController } from "./interface/model"
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

const DEFAULT_GREETING = "欢迎使用 claude-code-mini"

const KIMI_STORE_KEY = "kimi"

/**
 * 启动类 / 组合根（composition root）。
 *
 * 命令解析委托给 cli.ts（commander）；登录逻辑包装成 LoginService（CLI 与 TUI /login 共用）；
 * 聊天把 model + prompt 层组合成 Responder，并暴露 ModelController 供 /model 切换。
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

  /** 组合 model + prompt 层成对话能力：responder（注入 system prompt）+ models（列出/切换/配置状态）。 */
  private createChat(): { responder: Responder; models: ModelController } {
    const service = createModelService()
    const catalog = service.models()
    let current = catalog[0]?.id ?? "gpt-5.4"

    const responder: Responder = {
      respond: async (input, history) => {
        // 过滤空内容消息：空 assistant 轮次对 OpenAI 兼容接口（Kimi）是非法的。
        const prior = history
          .filter((m) => m.content.trim().length > 0)
          .map((m): ModelMessage => ({ role: m.role, content: m.content }))
        const messages: ModelMessage[] = [
          { role: "system", content: buildSystemPrompt(current) },
          ...prior,
          { role: "user", content: input },
        ]
        const result = await service.complete({ model: current, messages })
        return result.type === "text" ? result.text : "（模型请求了工具调用，工具层尚未接入）"
      },
    }

    const models: ModelController = {
      list: async (): Promise<ModelChoice[]> => {
        const statuses = await service.status()
        return statuses.map((s) => ({
          id: s.id,
          label: `${s.id}（${s.provider}）`,
          configured: s.configured,
        }))
      },
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
        this.codexLoginOption("browser", "openai-auth · 浏览器登录（Codex / ChatGPT 订阅）"),
        this.codexLoginOption("device", "openai-auth · 设备码登录（headless）"),
        this.kimiLoginOption(),
      ],
    }
  }

  private codexLoginOption(method: CodexLoginMethod, label: string): LoginOption {
    return {
      label,
      run: async (ctx) => {
        const tokens = await loginCodex(this.store, method, ctx.info)
        const account = tokens.accountId === undefined ? "" : `（account: ${tokens.accountId}）`
        return `登录成功${account}。凭证已保存。`
      },
    }
  }

  private kimiLoginOption(): LoginOption {
    return {
      label: "kimi · 粘贴 API key（Kimi Code 订阅）",
      run: async (ctx) => {
        const key = (await ctx.prompt("粘贴 Kimi API key 后回车：")).trim()
        if (key.length === 0) throw new Error("未输入 API key")
        await this.store.setApiKey(KIMI_STORE_KEY, key)
        return "Kimi API key 已保存。"
      },
    }
  }

  /** CLI 层登录：无 provider 时交互式选择，否则按 provider/--device 直接选。 */
  private async runLogin(provider: string | undefined, device: boolean): Promise<void> {
    const option =
      provider === undefined ? await this.pickLoginOption() : this.loginByProvider(provider, device)
    const ctx: LoginContext = {
      info: (info) => {
        console.log(info)
      },
      prompt: (label) => consolePrompt(label),
    }
    console.log(await option.run(ctx))
  }

  private pickLoginOption(): Promise<LoginOption> {
    const options: SelectOption<LoginOption>[] = this.loginService().options.map((o) => ({
      label: o.label,
      value: o,
    }))
    return promptSelect("选择登录方式：", options)
  }

  private loginByProvider(provider: string, device: boolean): LoginOption {
    if (provider === "kimi") return this.kimiLoginOption()
    if (provider === "openai" || provider === "codex") {
      return this.codexLoginOption(device ? "device" : "browser", "openai-auth")
    }
    throw new Error(`暂不支持登录: ${provider}（支持 openai-auth / kimi）`)
  }
}

/** CLI 下读取一行输入（如粘贴 API key）。 */
async function consolePrompt(label: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return await rl.question(`${label} `)
  } finally {
    rl.close()
  }
}
