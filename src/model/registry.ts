import type { ModelProvider } from "./provider"

/** 一个模型的元数据。contextWindow 等按需扩展（能力位、价格等）。 */
export interface ModelInfo {
  id: string
  /** 归属的 provider 标识，对应 ModelProvider.id。 */
  provider: string
  contextWindow: number
}

/**
 * 模型管理：登记有哪些 provider、有哪些模型，并能按模型 id 找到承载它的 provider。
 * 纯查表，不发请求。
 */
export class ModelRegistry {
  private readonly models = new Map<string, ModelInfo>()
  private readonly providers = new Map<string, ModelProvider>()

  registerProvider(provider: ModelProvider): void {
    this.providers.set(provider.id, provider)
  }

  registerModel(info: ModelInfo): void {
    this.models.set(info.id, info)
  }

  getModel(id: string): ModelInfo {
    const info = this.models.get(id)
    if (info === undefined) {
      throw new Error(`未知模型: ${id}`)
    }
    return info
  }

  getProvider(id: string): ModelProvider {
    const provider = this.providers.get(id)
    if (provider === undefined) {
      throw new Error(`未注册 provider: ${id}`)
    }
    return provider
  }

  /** 按模型 id 找到承载它的 provider（模型 → provider 的解析）。 */
  providerForModel(modelId: string): ModelProvider {
    return this.getProvider(this.getModel(modelId).provider)
  }

  list(): ModelInfo[] {
    return [...this.models.values()]
  }
}
