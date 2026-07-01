import { AuthStore } from "./auth-store"
import { apiKeyCredential } from "./credential"
import { CodexProvider } from "./providers/codex"
import { codexOAuthCredential } from "./providers/codex-oauth"
import { KimiProvider } from "./providers/kimi"
import type { ModelInfo } from "./registry"
import { ModelRegistry } from "./registry"
import type { ModelPurpose } from "./router"
import { Router } from "./router"
import type { ModelMessage, ModelRequest, ModelResponse, ToolDefinition } from "./types"

export type { ModelInfo } from "./registry"
export type { ModelPurpose } from "./router"
export type { ModelMessage, ModelRequest, ModelResponse, ToolDefinition } from "./types"

/**
 * 模型层门面（facade）：装配 registry + router + providers，对外提供"决策"入口。
 * agent 层只跟它打交道，不直接碰 provider / credential。
 */
export class ModelService {
  constructor(
    private readonly registry: ModelRegistry,
    private readonly router: Router,
  ) {}

  /** 显式指定模型的调用。 */
  async complete(request: ModelRequest): Promise<ModelResponse> {
    return this.registry.providerForModel(request.model).complete(request)
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
}

// 模型目录：contextWindow 为估值；codex 模型 id 取自 opencode 的 ALLOWED_MODELS，
// 若后端拒绝该 id，换成 "gpt-5.5" 等再试。
const MODEL_CATALOG: readonly ModelInfo[] = [
  { id: "gpt-5.4", provider: "codex", contextWindow: 272_000 },
  { id: "kimi-k2", provider: "kimi", contextWindow: 128_000 },
]

/**
 * 默认装配：注册 codex / kimi 两个 provider、登记模型目录、配置路由默认值。
 * 组合根（bootstrap）调用它拿到可用的 ModelService。
 *
 * 注意：codex.complete() 已实现（需先 /login）；kimi.complete() 仍是未实现桩。
 */
export function createModelService(): ModelService {
  const registry = new ModelRegistry()
  // 解构避开 index-signature 访问（tsc）与字面量键（biome）的规则冲突。
  const { MOONSHOT_API_KEY } = process.env
  const authStore = new AuthStore()

  registry.registerProvider(new CodexProvider({ credential: codexOAuthCredential(authStore) }))
  registry.registerProvider(
    new KimiProvider({ credential: apiKeyCredential(MOONSHOT_API_KEY ?? "") }),
  )

  for (const info of MODEL_CATALOG) {
    registry.registerModel(info)
  }

  const router = new Router({
    defaults: { main: "gpt-5.4", subagent: "kimi-k2", cheap: "kimi-k2" },
  })

  return new ModelService(registry, router)
}
