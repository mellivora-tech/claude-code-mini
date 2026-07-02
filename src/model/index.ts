import { AuthStore } from "./auth-store"
import { storedApiKeyCredential } from "./credential"
import { CodexProvider } from "./providers/codex"
import { codexOAuthCredential } from "./providers/codex-oauth"
import { KimiProvider } from "./providers/kimi"
import type { ModelInfo } from "./registry"
import { ModelRegistry } from "./registry"
import type { ModelPurpose } from "./router"
import { Router } from "./router"
import type {
  ModelMessage,
  ModelRequest,
  ModelResponse,
  ModelStreamEvent,
  ToolDefinition,
} from "./types"

export type { ModelInfo } from "./registry"
export type { ModelPurpose } from "./router"
export type {
  ModelMessage,
  ModelRequest,
  ModelResponse,
  ModelStreamEvent,
  ToolDefinition,
  Usage,
} from "./types"

/** 一个模型的配置状态：是否已具备可用凭证。 */
export interface ModelStatus {
  id: string
  provider: string
  configured: boolean
}

/**
 * 模型层门面（facade）：装配 registry + router + providers，对外提供"决策"入口。
 * agent 层只跟它打交道，不直接碰 provider / credential。
 */
export class ModelService {
  constructor(
    private readonly registry: ModelRegistry,
    private readonly router: Router,
  ) {}

  /** 显式指定模型的流式调用——上层（query）用这个拿实时增量。 */
  stream(request: ModelRequest): AsyncIterable<ModelStreamEvent> {
    return this.registry.providerForModel(request.model).stream(request)
  }

  /** 显式指定模型的一次性调用：抽干流、返回最终响应（状态检查 / 不关心增量的调用者用）。 */
  async complete(request: ModelRequest): Promise<ModelResponse> {
    return drain(this.stream(request))
  }

  /** 按用途路由后调用——上层通常用这个，不必关心具体模型 id。 */
  async completeFor(
    purpose: ModelPurpose,
    messages: ModelMessage[],
    tools?: ToolDefinition[],
  ): Promise<ModelResponse> {
    const model = this.router.route(purpose)
    const request: ModelRequest =
      tools === undefined ? { model, messages } : { model, messages, tools }
    return this.complete(request)
  }

  /** 列出所有已登记模型（模型管理的读侧）。 */
  models(): ModelInfo[] {
    return this.registry.list()
  }

  /** 列出模型及其配置状态（凭证是否就绪）。按 provider 缓存 isConfigured 结果。 */
  async status(): Promise<ModelStatus[]> {
    const cache = new Map<string, boolean>()
    const out: ModelStatus[] = []
    for (const info of this.registry.list()) {
      let configured = cache.get(info.provider)
      if (configured === undefined) {
        const provider = this.registry.getProvider(info.provider)
        configured = (await provider.isConfigured?.()) ?? true
        cache.set(info.provider, configured)
      }
      out.push({ id: info.id, provider: info.provider, configured })
    }
    return out
  }
}

/** 抽干一个模型流，返回其最终响应（done 事件里装配好的 ModelResponse）。 */
async function drain(stream: AsyncIterable<ModelStreamEvent>): Promise<ModelResponse> {
  let response: ModelResponse | undefined
  for await (const event of stream) {
    if (event.type === "done") response = event.response
  }
  if (response === undefined) throw new Error("模型流未产出 done 事件")
  return response
}

// 模型目录：contextWindow 为估值。codex id 取自 opencode ALLOWED_MODELS（后端拒绝则换 gpt-5.5 等）；
// kimi 走 Kimi Code（coding plan）的 OpenAI 兼容模型 id。
const MODEL_CATALOG: readonly ModelInfo[] = [
  { id: "gpt-5.4", provider: "codex", contextWindow: 272_000 },
  { id: "kimi-for-coding", provider: "kimi", contextWindow: 262_144 },
]

/**
 * 默认装配：注册 codex / kimi 两个 provider、登记模型目录、配置路由默认值。
 * 组合根（bootstrap）调用它拿到可用的 ModelService。
 *
 * codex 用订阅登录态（/login）；kimi 用 API key（/login 保存，或环境变量 KIMI_API_KEY）。
 */
export function createModelService(): ModelService {
  const registry = new ModelRegistry()
  const authStore = new AuthStore()

  registry.registerProvider(new CodexProvider({ credential: codexOAuthCredential(authStore) }))
  registry.registerProvider(
    new KimiProvider({ credential: storedApiKeyCredential(authStore, "kimi", "KIMI_API_KEY") }),
  )

  for (const info of MODEL_CATALOG) {
    registry.registerModel(info)
  }

  const router = new Router({
    defaults: { main: "gpt-5.4", subagent: "kimi-for-coding", cheap: "kimi-for-coding" },
  })

  return new ModelService(registry, router)
}
