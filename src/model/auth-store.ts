import { mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

/** 一组 OAuth 登录态凭证（按 provider 存储）。 */
export interface OAuthTokens {
  access: string
  refresh: string
  /** access token 过期时间（epoch 毫秒）。 */
  expires: number
  accountId?: string
}

function defaultAuthPath(): string {
  // 解构避开 index-signature 访问（tsc）与字面量键（biome）的规则冲突。
  const { XDG_CONFIG_HOME } = process.env
  const base = XDG_CONFIG_HOME ?? join(homedir(), ".config")
  return join(base, "claude-code-mini", "auth.json")
}

/**
 * 持久化各 provider 的 OAuth 登录态。落盘为单个 JSON：{ [provider]: OAuthTokens }。
 * 文件按 0600 权限写（含 token，不应对其他用户可读）。
 */
export class AuthStore {
  private readonly filePath: string

  constructor(filePath: string = defaultAuthPath()) {
    this.filePath = filePath
  }

  async all(): Promise<Record<string, OAuthTokens>> {
    try {
      const raw = await readFile(this.filePath, "utf8")
      return JSON.parse(raw) as Record<string, OAuthTokens>
    } catch {
      // 文件不存在或损坏时，视为空存储。
      return {}
    }
  }

  async get(provider: string): Promise<OAuthTokens | undefined> {
    return (await this.all())[provider]
  }

  async set(provider: string, tokens: OAuthTokens): Promise<void> {
    const store = await this.all()
    store[provider] = tokens
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 })
  }
}
