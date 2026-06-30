import type { Responder } from "./interface/responder"
import { createEchoResponder } from "./interface/responder"
import { runTui } from "./interface/run"

const DEFAULT_GREETING =
  "欢迎使用 claude-code-mini。这是 interface 层的演示 TUI，当前用 mock 响应。"

/**
 * 启动类 / 组合根（composition root）。
 *
 * 职责：解析启动参数 → 组装各层依赖 → 拉起界面。
 * 目前只接了 interface 层 + mock responder。后续在这里扩展：
 *   - 参数解析（commander）：子命令、选项
 *   - 接入 model / agent 层，按参数选择真实 responder
 */
export class Bootstrap {
  async run(argv: readonly string[] = process.argv): Promise<void> {
    // TODO(参数解析): 用 commander 解析 argv，据此决定启动行为与依赖装配
    const responder = this.createResponder(argv)
    await runTui({ responder, greeting: DEFAULT_GREETING })
  }

  private createResponder(argv: readonly string[]): Responder {
    // 目前忽略 argv，固定返回 mock；接入模型层后按解析结果切换实现
    void argv
    return createEchoResponder()
  }
}
