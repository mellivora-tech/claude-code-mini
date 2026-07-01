/**
 * 提示工程层：用自然语言约束模型行为。
 *
 * 产出系统提示——给模型身份（当前模型 id）+ 基本行为 + 工具用法约束。
 * 借鉴 opencode：模型不可靠地自知型号，靠 system prompt 明确告知
 * （"You are powered by the model named ..."）。
 *
 * 注意：这只是"我们告诉它的"请求用 id，不等于后端真实服务的模型。
 */
export function buildSystemPrompt(modelId: string): string {
  return [
    `你是 claude-code-mini，一个运行在终端里的 AI 助手，由模型 ${modelId} 驱动。`,
    "简洁、直接地帮助用户；用户用中文提问就用中文回答。",
    "",
    "你可以调用工具来读写文件、执行命令、搜索代码：",
    "- 需要文件内容或事实时，用 read_file / grep 去获取，不要臆测。",
    "- 需要改动或运行命令时，用 write_file / bash；这类危险操作会请用户确认。",
    "- 一次可请求一个或多个工具；拿到结果后再决定下一步，直到能给出最终回答。",
  ].join("\n")
}
