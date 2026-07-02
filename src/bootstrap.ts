import { createInterface } from "node:readline/promises"
import { createMemoryStore, QueryEngine } from "./agent/engine"
import { buildCli } from "./cli"
import type { LoginContext, LoginOption, LoginService } from "./interface/login"
import type { ModelChoice, ModelController } from "./interface/model"
import type { SelectOption } from "./interface/prompt"
import { promptSelect } from "./interface/prompt"
import type { ConfirmFn, Responder } from "./interface/responder"
import { runTui } from "./interface/run"
import { AuthStore } from "./model/auth-store"
import { createModelService } from "./model/index"
import type { CodexLoginMethod } from "./model/providers/codex-oauth"
import { loginCodex } from "./model/providers/codex-oauth"
import { createPermissionGate } from "./permission/gate"
import { buildSystemPrompt } from "./prompt/system"
import { createBuiltinRegistry } from "./tools/builtin/index"

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

  /**
   * 组合 model + tools + permission + prompt 成对话能力：
   * responder（QueryEngine 支撑的事件流）+ models（列出/切换/配置状态）。
   */
  private createChat(): { responder: Responder; models: ModelController } {
    const service = createModelService()
    const catalog = service.models()
    let current = catalog[0]?.id ?? "gpt-5.4"

    // 权限确认走一个可替换的 holder：每次 send 由界面注入当轮的 confirm 回调。
    const confirm: { fn: ConfirmFn } = { fn: async () => false }
    const engine = new QueryEngine(
      {
        model: service,
        tools: createBuiltinRegistry(),
        permission: createPermissionGate((call) => confirm.fn(call)),
        system: (modelId) => buildSystemPrompt(modelId),
        modelId: () => current,
      },
      createMemoryStore(),
    )

    const responder: Responder = {
      send: (input, confirmFn) => {
        confirm.fn = confirmFn
        return engine.send(input, { cwd: process.cwd() })
      },
      interrupt: () => engine.interrupt(),
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
