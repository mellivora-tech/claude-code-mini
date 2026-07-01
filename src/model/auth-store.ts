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

/** API key 凭证条目。 */
export interface ApiKeyEntry {
  key: string
}

// 存储条目：OAuth（有 access/refresh）或 API key（有 key）。结构上可区分，无需 type 字段，
// 从而兼容此前已落盘的 codex OAuth 记录（不带 type）。
type StoredEntry = OAuthTokens | ApiKeyEntry

function isOAuth(entry: StoredEntry): entry is OAuthTokens {
  return "access" in entry
}

function isApiKey(entry: StoredEntry): entry is ApiKeyEntry {
  return "key" in entry
}

function defaultAuthPath(): string {
  // 解构避开 index-signature 访问（tsc）与字面量键（biome）的规则冲突。
  const { XDG_CONFIG_HOME } = process.env
  const base = XDG_CONFIG_HOME ?? join(homedir(), ".config")
  return join(base, "claude-code-mini", "auth.json")
}

/**
 * 持久化各 provider 的凭证。落盘为单个 JSON：{ [provider]: OAuthTokens | ApiKeyEntry }。
 * 文件按 0600 权限写（含密钥，不应对其他用户可读）。
 */
export class AuthStore {
  private readonly filePath: string

  constructor(filePath: string = defaultAuthPath()) {
    this.filePath = filePath
  }

  async all(): Promise<Record<string, StoredEntry>> {
    try {
      const raw = await readFile(this.filePath, "utf8")
      return JSON.parse(raw) as Record<string, StoredEntry>
    } catch {
      // 文件不存在或损坏时，视为空存储。
      return {}
    }
  }

  private async write(store: Record<string, StoredEntry>): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 })
  }

  async get(provider: string): Promise<OAuthTokens | undefined> {
    const entry = (await this.all())[provider]
    return entry !== undefined && isOAuth(entry) ? entry : undefined
  }

  async set(provider: string, tokens: OAuthTokens): Promise<void> {
    const store = await this.all()
    store[provider] = tokens
    await this.write(store)
  }

  async getApiKey(provider: string): Promise<string | undefined> {
    const entry = (await this.all())[provider]
    return entry !== undefined && isApiKey(entry) ? entry.key : undefined
  }

  async setApiKey(provider: string, key: string): Promise<void> {
    const store = await this.all()
    store[provider] = { key }
    await this.write(store)
  }
}
