import type { ModelMessage, Usage } from "../model/types"
import type { PermissionGate } from "../permission/gate"
import type { ToolRegistry } from "../tools/registry"
import type { ToolContext } from "../tools/tool"
import type { QueryEvent } from "./events"
import { query, type StreamingModel } from "./query"

/** 一次对话的可持久化状态。 */
export interface Conversation {
  messages: ModelMessage[]
  usage: Usage
}

/** 会话持久化的落点。先做内存实现，Phase F 落盘到 memory/session。 */
export interface SessionStore {
  save(convo: Conversation): Promise<void>
}

/** 对话级策略。 */
export interface EnginePolicy {
  /** 输出 token 预算；累计超过即中断本轮。undefined 表示不限。 */
  maxOutputTokens?: number
}

export interface EngineDeps {
  model: StreamingModel
  tools: ToolRegistry
  permission: PermissionGate
  /** 按当前模型 id 产出 system prompt（模型可 /model 切换，故用函数）。 */
  system: (modelId: string) => string
  /** 读取当前选中的模型 id（实时，反映 /model 切换）。 */
  modelId: () => string
  maxSteps?: number
}

/**
 * 对话生命周期（策略层）：关心"这个对话要不要继续"——持久化、预算检查、用户中断、多轮。
 *
 * 每次 send 驱动一轮 query（单轮循环），并只通过三条通道与之耦合：
 *   ① 传入自己拥有的 messages（query 往里 push）
 *   ② 传入 abort signal（预算/中断都折射成它）
 *   ③ 消费 query 吐出的事件流（记 usage、转发给界面）
 */
export class QueryEngine {
  private readonly convo: Conversation = {
    messages: [],
    usage: { inputTokens: 0, outputTokens: 0 },
  }
  private controller: AbortController | null = null

  constructor(
    private readonly deps: EngineDeps,
    private readonly store: SessionStore,
    private readonly policy: EnginePolicy = {},
  ) {}

  /** 一次用户输入 → 一轮对话；产出事件流供界面渲染。 */
  async *send(
    input: string,
    base: Omit<ToolContext, "signal">,
  ): AsyncGenerator<QueryEvent, void, unknown> {
    const modelId = this.deps.modelId()
    this.ensureSystem(modelId)
    this.convo.messages.push({ role: "user", content: input })

    this.controller = new AbortController()
    const ctx: ToolContext = { ...base, signal: this.controller.signal }
    const deps = {
      model: this.deps.model,
      tools: this.deps.tools,
      permission: this.deps.permission,
      modelId,
      ...(this.deps.maxSteps !== undefined ? { maxSteps: this.deps.maxSteps } : {}),
    }

    try {
      for await (const event of query(this.convo.messages, deps, ctx)) {
        if (event.type === "usage") {
          this.convo.usage.inputTokens += event.usage.inputTokens
          this.convo.usage.outputTokens += event.usage.outputTokens
          // 预算闸（step 级）：超了就 abort，让当前轮优雅收尾。
          if (this.overBudget()) this.controller.abort()
        }
        yield event
      }
    } finally {
      this.controller = null
      await this.store.save(this.convo)
    }
  }

  /** 用户中断（Ctrl+C / Esc）：取消在途请求，query 会走 done(aborted)。 */
  interrupt(): void {
    this.controller?.abort()
  }

  /** 累计输出 token 的用量（供界面展示预算）。 */
  usage(): Usage {
    return { ...this.convo.usage }
  }

  private overBudget(): boolean {
    const max = this.policy.maxOutputTokens
    return max !== undefined && this.convo.usage.outputTokens >= max
  }

  // 保证 messages[0] 是与当前模型匹配的 system prompt（切换模型时刷新）。
  private ensureSystem(modelId: string): void {
    const content = this.deps.system(modelId)
    const head = this.convo.messages[0]
    if (head !== undefined && head.role === "system") head.content = content
    else this.convo.messages.unshift({ role: "system", content })
  }
}

/** 内存版 SessionStore：保留最后一次保存的快照，便于观察 / 测试。 */
export function createMemoryStore(): SessionStore & { last: () => Conversation | undefined } {
  let snapshot: Conversation | undefined
  return {
    async save(convo) {
      snapshot = { messages: [...convo.messages], usage: { ...convo.usage } }
    },
    last() {
      return snapshot
    },
  }
}
