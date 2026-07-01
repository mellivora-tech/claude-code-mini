/**
 * 提示工程层：用自然语言约束模型行为。
 *
 * 目前只产出一段极简的系统提示——给模型身份（当前模型 id）+ 基本行为。
 * 借鉴 opencode：模型不可靠地自知型号，靠 system prompt 明确告知
 * （"You are powered by the model named ..."）。
 *
 * 注意：这只是"我们告诉它的"请求用 id，不等于后端真实服务的模型。
 * 完整的"编码 agent"提示词（工具用法等）等 tools 层落地后再补。
 */
export function buildSystemPrompt(modelId: string): string {
  return [
    `你是 claude-code-mini，一个运行在终端里的 AI 助手，由模型 ${modelId} 驱动。`,
    "简洁、直接地帮助用户；用户用中文提问就用中文回答。",
  ].join("\n")
}
