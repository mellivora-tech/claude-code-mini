import { Command } from "commander"

/**
 * CLI 命令处理器：由组合根（bootstrap）提供具体实现。
 * cli.ts 只负责命令结构（用 commander 解析），不含业务逻辑。
 */
export interface CliHandlers {
  /** shell 层登录：`claude-code-mini login [provider] [--device]`。 */
  login(provider: string | undefined, device: boolean): Promise<void>
  /** 无子命令时的默认行为：拉起 TUI。 */
  runTui(): Promise<void>
}

/** 构建 commander 程序。注意：TUI 内的 /login 不走这里，由界面层自行解析。 */
export function buildCli(handlers: CliHandlers): Command {
  const program = new Command()
  program.name("claude-code-mini").description("claude-code-mini")

  program
    .command("login [provider]")
    .description("登录模型服务商（不带 provider 时交互式选择）")
    .option("-d, --device", "使用设备码流程（默认浏览器）")
    .action(async (provider: string | undefined, opts: { device?: boolean }) => {
      await handlers.login(provider, opts.device === true)
    })

  program.action(async () => {
    await handlers.runTui()
  })

  return program
}
