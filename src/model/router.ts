/** 模型用途——路由的输入。按"角色/场景"选模型，而非让上层写死具体 id。 */
export type ModelPurpose = "main" | "subagent" | "cheap"

export interface RouterConfig {
  /** 每种用途的默认模型 id。 */
  defaults: Record<ModelPurpose, string>
}

/**
 * 路由：把"用途"映射到具体模型 id。
 * 起步只做配置驱动的默认值；以后可扩展成按成本/能力/上下文长度动态选。
 */
export class Router {
  constructor(private readonly config: RouterConfig) {}

  route(purpose: ModelPurpose): string {
    return this.config.defaults[purpose]
  }
}
