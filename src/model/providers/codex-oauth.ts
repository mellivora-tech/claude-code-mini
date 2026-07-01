import { createServer } from "node:http"
import { setTimeout as sleep } from "node:timers/promises"
import type { AuthStore, OAuthTokens } from "../auth-store"
import type { Credential } from "../credential"

/**
 * Codex（ChatGPT 订阅）OAuth 登录 —— 路径 A：自跑 OAuth PKCE 流程、存自己的 token。
 * 移植自 opencode 的 packages/opencode/src/plugin/openai/codex.ts。
 *
 * 用的是 Codex CLI 的公开 client_id（PKCE 公共客户端，无 client_secret）。
 * 注意：ChatGPT 后端属非官方接口，端点/参数可能随上游变动。
 */

const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
const ISSUER = "https://auth.openai.com"
/** ChatGPT 后端的 Responses 端点（订阅登录态调用，非官方 API）。 */
export const CODEX_RESPONSES_ENDPOINT = "https://chatgpt.com/backend-api/codex/responses"
const CALLBACK_PORT = 1455
const DEVICE_POLL_SAFETY_MARGIN_MS = 3000
export const USER_AGENT = `claude-code-mini/0.1.0 (${process.platform})`
// originator 随请求上报。实测自定义值（如 "claude-code-mini"）会被 OpenAI 拒绝授权，
// 必须用上游认可的取值——沿用 opencode 的 "opencode"。改动前先确认新值能通过授权。
export const ORIGINATOR = "opencode"

const STORE_KEY = "codex"

/** provider 标识，供别处引用（与 AuthStore 的 key、ModelProvider.id 对齐）。 */
export const CODEX_PROVIDER_ID = STORE_KEY

export interface TokenResponse {
  id_token?: string
  access_token: string
  refresh_token: string
  expires_in?: number
}

interface PkceCodes {
  verifier: string
  challenge: string
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export async function generatePKCE(): Promise<PkceCodes> {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
  const random = crypto.getRandomValues(new Uint8Array(43))
  const verifier = Array.from(random, (b) => chars[b % chars.length]).join("")
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  return { verifier, challenge: base64UrlEncode(digest) }
}

export function buildAuthorizeUrl(redirectUri: string, pkce: PkceCodes, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "openid profile email offline_access",
    code_challenge: pkce.challenge,
    code_challenge_method: "S256",
    id_token_add_organizations: "true",
    codex_cli_simplified_flow: "true",
    state,
    originator: ORIGINATOR,
  })
  return `${ISSUER}/oauth/authorize?${params.toString()}`
}

interface IdTokenClaims {
  chatgpt_account_id?: string
  organizations?: Array<{ id: string }>
  "https://api.openai.com/auth"?: { chatgpt_account_id?: string }
}

export function parseJwtClaims(token: string): IdTokenClaims | undefined {
  const parts = token.split(".")
  const payload = parts[1]
  if (parts.length !== 3 || payload === undefined) return undefined
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as IdTokenClaims
  } catch {
    return undefined
  }
}

export function extractAccountId(tokens: {
  id_token?: string
  access_token?: string
}): string | undefined {
  for (const token of [tokens.id_token, tokens.access_token]) {
    if (token === undefined) continue
    const claims = parseJwtClaims(token)
    const accountId =
      claims?.chatgpt_account_id ??
      claims?.["https://api.openai.com/auth"]?.chatgpt_account_id ??
      claims?.organizations?.[0]?.id
    if (accountId !== undefined) return accountId
  }
  return undefined
}

/** 把 OAuth token 响应折算成可持久化的 OAuthTokens。 */
export function toTokens(
  response: TokenResponse,
  fallbackAccountId: string | undefined,
  now: () => number,
): OAuthTokens {
  const accountId = extractAccountId(response) ?? fallbackAccountId
  const base = {
    access: response.access_token,
    refresh: response.refresh_token,
    expires: now() + (response.expires_in ?? 3600) * 1000,
  }
  return accountId === undefined ? base : { ...base, accountId }
}

async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  pkce: PkceCodes,
): Promise<TokenResponse> {
  const res = await fetch(`${ISSUER}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: CLIENT_ID,
      code_verifier: pkce.verifier,
    }).toString(),
  })
  if (!res.ok) throw new Error(`换取 token 失败: ${res.status}`)
  return (await res.json()) as TokenResponse
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(`${ISSUER}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }).toString(),
  })
  if (!res.ok) throw new Error(`刷新 token 失败: ${res.status}`)
  return (await res.json()) as TokenResponse
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open"
  try {
    Bun.spawn([cmd, url], { stdout: "ignore", stderr: "ignore" })
  } catch {
    // best-effort：打不开就靠用户手动复制 URL。
  }
}

/** 浏览器流程：起本地回调服务器 + 打开浏览器授权。 */
async function browserFlow(onInfo: (message: string) => void): Promise<TokenResponse> {
  const pkce = await generatePKCE()
  const state = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)).buffer)
  const redirectUri = `http://localhost:${CALLBACK_PORT}/auth/callback`
  const authUrl = buildAuthorizeUrl(redirectUri, pkce, state)

  return new Promise<TokenResponse>((resolve, reject) => {
    const server = createServer((req, res) => {
      const reqUrl = new URL(req.url ?? "/", `http://localhost:${CALLBACK_PORT}`)
      if (reqUrl.pathname !== "/auth/callback") {
        res.writeHead(404)
        res.end()
        return
      }
      const respond = (message: string) => {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
        res.end(`<html><body>${message}，可关闭本页返回终端。</body></html>`)
        server.close()
      }
      const error = reqUrl.searchParams.get("error")
      if (error !== null) {
        respond(`登录失败: ${error}`)
        reject(new Error(error))
        return
      }
      const code = reqUrl.searchParams.get("code")
      const returnedState = reqUrl.searchParams.get("state")
      if (code === null || returnedState !== state) {
        respond("登录失败: 无效回调（code 缺失或 state 不匹配）")
        reject(new Error("无效的 OAuth 回调"))
        return
      }
      respond("登录成功")
      exchangeCodeForTokens(code, redirectUri, pkce).then(resolve).catch(reject)
    })

    server.on("error", reject)
    server.listen(CALLBACK_PORT, () => {
      onInfo(`请在浏览器完成授权（若未自动打开，手动访问）:\n${authUrl}`)
      openBrowser(authUrl)
    })

    // 5 分钟超时。
    setTimeout(
      () => {
        server.close()
        reject(new Error("OAuth 回调超时"))
      },
      5 * 60 * 1000,
    ).unref()
  })
}

/** 设备码流程：显示 user_code，轮询直到用户在浏览器完成授权。 */
async function deviceCodeFlow(onInfo: (message: string) => void): Promise<TokenResponse> {
  const init = await fetch(`${ISSUER}/api/accounts/deviceauth/usercode`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify({ client_id: CLIENT_ID }),
  })
  if (!init.ok) throw new Error(`申请设备码失败: ${init.status}`)
  const data = (await init.json()) as {
    device_auth_id: string
    user_code: string
    interval: string
  }
  const interval = Math.max(Number.parseInt(data.interval, 10) || 5, 1) * 1000
  onInfo(`打开 ${ISSUER}/codex/device 并输入验证码: ${data.user_code}`)

  while (true) {
    const res = await fetch(`${ISSUER}/api/accounts/deviceauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
      body: JSON.stringify({ device_auth_id: data.device_auth_id, user_code: data.user_code }),
    })
    if (res.ok) {
      const granted = (await res.json()) as { authorization_code: string; code_verifier: string }
      const tokenRes = await fetch(`${ISSUER}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: granted.authorization_code,
          redirect_uri: `${ISSUER}/deviceauth/callback`,
          client_id: CLIENT_ID,
          code_verifier: granted.code_verifier,
        }).toString(),
      })
      if (!tokenRes.ok) throw new Error(`换取 token 失败: ${tokenRes.status}`)
      return (await tokenRes.json()) as TokenResponse
    }
    // 403/404 = 尚未授权，继续轮询；其他状态视为失败。
    if (res.status !== 403 && res.status !== 404) {
      throw new Error(`设备授权失败: ${res.status}`)
    }
    await sleep(interval + DEVICE_POLL_SAFETY_MARGIN_MS)
  }
}

export type CodexLoginMethod = "browser" | "device"

/** 跑一次登录流程，把结果 token 落盘到 store。 */
export async function loginCodex(
  store: AuthStore,
  method: CodexLoginMethod,
  onInfo: (message: string) => void,
): Promise<OAuthTokens> {
  const response = method === "device" ? await deviceCodeFlow(onInfo) : await browserFlow(onInfo)
  const tokens = toTokens(response, undefined, Date.now)
  await store.set(STORE_KEY, tokens)
  return tokens
}

export interface CodexCredentialDeps {
  /** 注入用于测试；默认打真实 OAuth 刷新端点。 */
  refresh?: (refreshToken: string) => Promise<TokenResponse>
  now?: () => number
}

/**
 * Codex 订阅登录态鉴权：读 store 里的 token，过期则用 refresh_token 刷新并写回，
 * 产出 Authorization + ChatGPT-Account-Id 头。
 * （originator / User-Agent / session-id 等请求级头留给 provider.complete()。）
 */
export function codexOAuthCredential(store: AuthStore, deps: CodexCredentialDeps = {}): Credential {
  const refresh = deps.refresh ?? refreshAccessToken
  const now = deps.now ?? Date.now
  let refreshing: Promise<OAuthTokens> | undefined

  const buildHeaders = (tokens: OAuthTokens): Record<string, string> => {
    const headers: Record<string, string> = { Authorization: `Bearer ${tokens.access}` }
    if (tokens.accountId !== undefined) headers["ChatGPT-Account-Id"] = tokens.accountId
    return headers
  }

  return {
    async authHeaders(): Promise<Record<string, string>> {
      const current = await store.get(STORE_KEY)
      if (current === undefined) {
        throw new Error("未登录 Codex，请先运行: claude-code-mini login codex")
      }
      if (current.expires >= now()) return buildHeaders(current)

      if (refreshing === undefined) {
        refreshing = (async () => {
          const response = await refresh(current.refresh)
          const next = toTokens(response, current.accountId, now)
          await store.set(STORE_KEY, next)
          return next
        })().finally(() => {
          refreshing = undefined
        })
      }
      return buildHeaders(await refreshing)
    },
  }
}
