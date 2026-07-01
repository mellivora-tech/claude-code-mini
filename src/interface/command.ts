/**
 * 斜杠命令抽象。App 只负责分发 + 提供通用交互原语；具体命令（login/model/…）
 * 在组合根注册,通过 CommandContext 组合出交互。加新命令 = 加一个 Command,App 不变。
 */

export interface CommandChoice<T> {
  label: string
  value: T
}

/** 命令运行时可用的界面能力（provider/领域无关）。 */
export interface CommandContext {
  /** 追加一条界面提示（meta 消息,不进模型历史）。 */
  print(message: string): void
  /** 弹单选,resolve 为选中项的值。 */
  select<T>(message: string, items: CommandChoice<T>[]): Promise<T>
  /** 弹单行文本输入（如粘贴 API key）,resolve 为输入内容。 */
  promptText(label: string): Promise<string>
  /** 退出程序。 */
  exit(): void
}

export interface Command {
  /** 触发名（不含斜杠）,如 "login" / "model" / "exit"。 */
  name: string
  description?: string
  run(ctx: CommandContext): Promise<void>
}
