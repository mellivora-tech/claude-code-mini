import type { ModelMessage, ModelRequest, ModelResponse, ModelStreamEvent } from "../model/types"
import type { PermissionGate } from "../permission/gate"
import type { ToolRegistry } from "../tools/registry"
import type { ToolContext } from "../tools/tool"
import type { QueryEvent } from "./events"

/** query 只需要模型的"能流式"这一面，便于测试时注入假实现。 */
export interface StreamingModel {
  stream(request: ModelRequest): AsyncIterable<ModelStreamEvent>
}

export interface QueryDeps {
  model: StreamingModel
  tools: ToolRegistry
  permission: PermissionGate
  /** 本轮使用的具体模型 id。 */
  modelId: string
  /** 单轮内模型↔工具往返的上限，兜底防死循环。默认 20。 */
  maxSteps?: number
  /** 首个增量吐出前的瞬时错误重试次数。默认 2。 */
  maxRetries?: number
}

/**
 * 单轮循环（机制层）：一次用户输入 → 模型↔工具往返，直到模型不再请求工具。
 *
 * 关心"这一轮怎么跑完"：流式转发、工具执行、错误恢复、循环终止。
 * 不碰持久化 / 预算 / 多轮——那是 QueryEngine 的事。messages 由调用方（Engine）
 * 拥有，本函数往里 append；ctx.signal 由 Engine 掌控（预算/中断都折射成它）。
 */
export async function* query(
  messages: ModelMessage[],
  deps: QueryDeps,
  ctx: ToolContext,
): AsyncGenerator<QueryEvent, void, unknown> {
  const maxSteps = deps.maxSteps ?? 20

  for (let step = 0; step < maxSteps; step++) {
    if (aborted(ctx.signal)) {
      yield { type: "done", reason: "aborted" }
      return
    }

    const request: ModelRequest = {
      model: deps.modelId,
      messages,
      tools: deps.tools.definitions(),
    }
    if (ctx.signal !== undefined) request.signal = ctx.signal

    // 消费模型流：text_delta 直通界面，末尾 done 拿装配好的完整响应。
    let final: ModelResponse | undefined
    try {
      for await (const event of streamWithRetry(deps, request, ctx.signal)) {
        if (event.type === "text_delta" || event.type === "reasoning_delta") {
          yield event
        } else {
          final = event.response
          if (event.usage !== undefined) yield { type: "usage", usage: event.usage }
        }
      }
    } catch (error) {
      // 中断（budget/用户）走 aborted，其余才算 error。
      if (aborted(ctx.signal)) yield { type: "done", reason: "aborted" }
      else yield { type: "done", reason: "error", message: describe(error) }
      return
    }

    if (final === undefined) {
      yield { type: "done", reason: "error", message: "模型流未产出响应" }
      return
    }

    // 文本响应 → 本轮到头，终止。
    if (final.type === "text") {
      messages.push({ role: "assistant", content: final.text })
      yield { type: "assistant", content: final.text }
      yield { type: "done", reason: "stop" }
      return
    }

    // 工具调用 → 记下请求、逐个执行、回填结果，然后进入下一步继续问模型。
    const calls = final.calls
    messages.push({ role: "assistant", content: "", toolCalls: calls })
    yield { type: "assistant", content: "", toolCalls: calls }

    for (const call of calls) {
      if (aborted(ctx.signal)) {
        yield { type: "done", reason: "aborted" }
        return
      }
      yield { type: "tool_start", call }
      const decision = await deps.permission.check(call, ctx)
      const result = decision.allowed
        ? await deps.tools.execute(call, ctx)
        : { output: `用户拒绝了工具 ${call.name}`, isError: true }
      messages.push({ role: "tool", content: result.output, toolCallId: call.id })
      yield {
        type: "tool_result",
        callId: call.id,
        output: result.output,
        isError: result.isError ?? false,
      }
    }
  }

  yield { type: "done", reason: "max_steps" }
}

/**
 * 错误恢复：瞬时错误只在"第一个增量吐出之前"重试——流一旦开始，重试会重复文本，
 * 故已 emit 后的失败直接抛出，由 query 转成 done(error)。
 */
async function* streamWithRetry(
  deps: QueryDeps,
  request: ModelRequest,
  signal?: AbortSignal,
): AsyncGenerator<ModelStreamEvent, void, unknown> {
  const maxRetries = deps.maxRetries ?? 2
  let attempt = 0
  while (true) {
    let emitted = false
    try {
      for await (const event of deps.model.stream(request)) {
        emitted = true
        yield event
      }
      return
    } catch (error) {
      if (emitted || attempt >= maxRetries || aborted(signal)) throw error
      attempt += 1
      await delay(2 ** attempt * 250)
    }
  }
}

/** 独立函数读取 aborted：避免 TS 在 await 前后把 signal.aborted 窄化成常量而误报。 */
function aborted(signal?: AbortSignal): boolean {
  return signal?.aborted === true
}

function delay(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
