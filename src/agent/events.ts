import type { ToolCall, Usage } from "../model/types"

/**
 * 编排层对外吐出的事件流。query（单轮）与 QueryEngine（对话）都产出这套事件，
 * 界面层据此实时渲染：text_delta 打字机、tool_* 状态行、done 收尾。
 */

/** 单轮结束的原因：正常停 / 触顶 / 被中断 / 出错。 */
export type DoneReason = "stop" | "max_steps" | "aborted" | "error"

export type QueryEvent =
  | { type: "text_delta"; text: string } // 助手文本增量
  | { type: "reasoning_delta"; text: string } // 模型思考过程增量
  | { type: "assistant"; content: string; toolCalls?: ToolCall[] } // 一条完整助手消息落定
  | { type: "tool_start"; call: ToolCall } // 开始执行某工具
  | { type: "tool_result"; callId: string; output: string; isError: boolean } // 工具结果
  | { type: "usage"; usage: Usage } // 本步 token 用量（Engine 记预算）
  | { type: "done"; reason: DoneReason; message?: string } // 本轮结束
