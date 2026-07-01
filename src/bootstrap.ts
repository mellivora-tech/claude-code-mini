import { createInterface } from "node:readline/promises"
import { buildCli } from "./cli"
import type { Command, CommandChoice, CommandContext } from "./interface/command"
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
 * 命令解析委托给 cli.ts（commander）；斜杠命令（/login、/model、/exit）定义成 Command，
 * 由 App 通过 CommandContext 统一分发；聊天把 model + prompt 层组合成 Responder。
 * 加新斜杠命令 = 在这里往 commands 里加一项，App 不用改。
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
    const { responder, commands } = this.buildTui()
    await runTui({ responder, greeting: DEFAULT_GREETING, commands })
  }

  /** 组合出 TUI 依赖：responder（注入 system prompt，读当前模型）+ 斜杠命令集。 */
  private buildTui(): { responder: Responder; commands: Command[] } {
    const service = createModelService()
    let current = service.models()[0]?.id ?? "gpt-5.4"

    const responder: Responder = {
      respond: async (input, history) => {
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

    const commands: Command[] = [
      { name: "exit", description: "退出", run: async (ctx) => ctx.exit() },
      { name: "quit", description: "退出", run: async (ctx) => ctx.exit() },
      { name: "login", description: "登录模型服务商", run: (ctx) => this.loginInteractive(ctx) },
      {
        name: "model",
        description: "切换模型",
        run: async (ctx) => {
          const statuses = await service.status()
          if (statuses.length === 0) {
            ctx.print("没有可选模型。")
            return
          }
          const id = await ctx.select(
            "选择模型：",
            statuses.map((s) => ({
              label: `${s.id}（${s.provider}）${s.configured ? " ✓" : " ·未配置"}`,
              value: s.id,
            })),
          )
          current = id
          ctx.print(`已切换模型：${id}`)
        },
      },
    ]

    return { responder, commands }
  }

  /** 交互式登录：选方式 → 执行 → 反馈。CLI 与 TUI 共用（ctx 不同）。 */
  private async loginInteractive(ctx: CommandContext): Promise<void> {
    const run = await ctx.select<() => Promise<string>>("选择登录方式：", [
      {
        label: "openai-auth · 浏览器登录（Codex / ChatGPT 订阅）",
        value: () => this.codexAuth("browser", ctx),
      },
      { label: "openai-auth · 设备码登录（headless）", value: () => this.codexAuth("device", ctx) },
      { label: "kimi · 粘贴 API key（Kimi Code 订阅）", value: () => this.kimiAuth(ctx) },
    ])
    ctx.print(await run())
  }

  private async codexAuth(method: CodexLoginMethod, ctx: CommandContext): Promise<string> {
    const tokens = await loginCodex(this.store, method, ctx.print)
    const account = tokens.accountId === undefined ? "" : `（account: ${tokens.accountId}）`
    return `登录成功${account}。凭证已保存。`
  }

  private async kimiAuth(ctx: CommandContext): Promise<string> {
    const key = (await ctx.promptText("粘贴 Kimi API key 后回车：")).trim()
    if (key.length === 0) throw new Error("未输入 API key")
    await this.store.setApiKey(KIMI_STORE_KEY, key)
    return "Kimi API key 已保存。"
  }

  /** CLI 层登录：无 provider 时交互式选择，否则按 provider/--device 直接选。 */
  private async runLogin(provider: string | undefined, device: boolean): Promise<void> {
    const ctx = consoleCommandContext()
    if (provider === undefined) {
      await this.loginInteractive(ctx)
      return
    }
    if (provider === "kimi") {
      ctx.print(await this.kimiAuth(ctx))
      return
    }
    if (provider === "openai" || provider === "codex") {
      ctx.print(await this.codexAuth(device ? "device" : "browser", ctx))
      return
    }
    throw new Error(`暂不支持登录: ${provider}（支持 openai-auth / kimi）`)
  }
}

/** CLI 下的 CommandContext：print→console，select→一次性 Ink 单选，promptText→readline。 */
function consoleCommandContext(): CommandContext {
  return {
    print: (message) => {
      console.log(message)
    },
    select<T>(message: string, items: CommandChoice<T>[]): Promise<T> {
      return promptSelect(message, items)
    },
    promptText: (label) => consolePrompt(label),
    exit: () => {},
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
