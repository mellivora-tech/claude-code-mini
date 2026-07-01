/**
 * 鉴权抽象——"订阅 vs API key" 的唯一分歧点。
 *
 * provider 只调用 authHeaders() 拿到要附加的请求头，不关心背后是登录态还是密钥。
 * 这样新增鉴权方式（OAuth 刷新、WIF 等）不影响 provider 与上层。
 *
 * 具体实现分布：
 *   - apiKeyCredential      —— 见下（Kimi / Moonshot）
 *   - codexOAuthCredential  —— 见 providers/codex-oauth.ts（Codex 订阅登录态）
 */
export interface Credential {
  authHeaders(): Promise<Record<string, string>>
}

/**
 * API key 鉴权（Kimi / Moonshot 用）。产出标准的 Bearer 头。
 */
export function apiKeyCredential(apiKey: string): Credential {
  return {
    async authHeaders() {
      if (apiKey.length === 0) {
        throw new Error("apiKeyCredential: 缺少 API key（检查环境变量是否已设置）")
      }
      return { Authorization: `Bearer ${apiKey}` }
    },
  }
}
