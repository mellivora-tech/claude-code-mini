/**
 * 模型选择的接口层契约（provider 无关）。
 * 组合根把 model 层的选型能力包装成 ModelController 注入界面；
 * 界面层只管"列出 / 当前 / 切换"，不碰 provider 细节。
 */
export interface ModelChoice {
  id: string
  label: string
  /** 凭证是否就绪（未配置的模型可选但用不了）。 */
  configured: boolean
}

export interface ModelController {
  /** 列出模型及配置状态（异步：需查各 provider 凭证）。 */
  list(): Promise<ModelChoice[]>
  current(): string
  select(id: string): void
}
