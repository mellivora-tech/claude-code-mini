import type { AuthStore } from "./auth-store"

/**
 * 鉴权抽象——"订阅 vs API key" 的唯一分歧点。
 *
 * provider 只调用 authHeaders() 拿到要附加的请求头，不关心背后是登录态还是密钥。
 * isConfigured() 供上层查询"是否已具备凭证"（不发网络），用于展示模型配置状态。
 *
 * 具体实现分布：
 *   - apiKeyCredential / storedApiKeyCredential —— 见下（Kimi / Moonshot）
 *   - codexOAuthCredential —— 见 providers/codex-oauth.ts（Codex 订阅登录态）
 */
export interface Credential {
  authHeaders(): Promise<Record<string, string>>
  /** 是否已具备可用凭证（轻量检查，不触发网络）。缺省视为已配置。 */
  isConfigured?(): Promise<boolean>
}

/**
 * 静态 API key 鉴权。产出标准的 Bearer 头。
 */
export function apiKeyCredential(apiKey: string): Credential {
  return {
    async authHeaders() {
      if (apiKey.length === 0) {
        throw new Error("apiKeyCredential: 缺少 API key")
      }
      return { Authorization: `Bearer ${apiKey}` }
    },
    async isConfigured() {
      return apiKey.length > 0
    },
  }
}

/**
 * 从 AuthStore 读取 API key 的鉴权（懒读：/login 保存后立即生效，无需重启）。
 * 找不到时回退到环境变量 envVar（若提供）。
 */
export function storedApiKeyCredential(
  store: AuthStore,
  provider: string,
  envVar?: string,
): Credential {
  const resolve = async (): Promise<string | undefined> => {
    const stored = await store.getApiKey(provider)
    if (stored !== undefined && stored.length > 0) return stored
    if (envVar === undefined) return undefined
    const fromEnv = process.env[envVar]
    return fromEnv !== undefined && fromEnv.length > 0 ? fromEnv : undefined
  }
  return {
    async authHeaders() {
      const key = await resolve()
      if (key === undefined) {
        throw new Error(`未配置 ${provider} 的 API key，请先 /login`)
      }
      return { Authorization: `Bearer ${key}` }
    },
    async isConfigured() {
      return (await resolve()) !== undefined
    },
  }
}
