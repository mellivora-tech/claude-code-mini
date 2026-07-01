import { afterEach, describe, expect, test } from "bun:test"
import { rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AuthStore } from "../src/model/auth-store"
import {
  buildAuthorizeUrl,
  codexOAuthCredential,
  extractAccountId,
  generatePKCE,
  toTokens,
} from "../src/model/providers/codex-oauth"

const tmpPath = join(tmpdir(), `ccm-codex-${process.pid}.json`)

afterEach(async () => {
  await rm(tmpPath, { force: true })
})

function jwt(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `header.${body}.sig`
}

describe("codex-oauth 纯逻辑", () => {
  test("generatePKCE：verifier 长度 43，challenge 是 base64url", async () => {
    const pkce = await generatePKCE()
    expect(pkce.verifier).toHaveLength(43)
    expect(pkce.challenge).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  test("buildAuthorizeUrl 带上 PKCE / client_id / state", () => {
    const url = buildAuthorizeUrl(
      "http://localhost:1455/auth/callback",
      {
        verifier: "v",
        challenge: "chal",
      },
      "st8",
    )
    expect(url).toContain("code_challenge=chal")
    expect(url).toContain("code_challenge_method=S256")
    expect(url).toContain("state=st8")
    expect(url).toContain("app_EMoamEEZ73f0CkXaXp7hrann")
  })

  test("extractAccountId 从 id_token 的 JWT claims 解出 account id", () => {
    const token = jwt({ chatgpt_account_id: "acc-xyz" })
    expect(extractAccountId({ id_token: token, access_token: "x" })).toBe("acc-xyz")
  })

  test("toTokens 折算过期时间，无 id_token 时回退到 fallback account id", () => {
    const tokens = toTokens(
      { access_token: "a", refresh_token: "r", expires_in: 100 },
      "fallback-acc",
      () => 1000,
    )
    expect(tokens).toEqual({
      access: "a",
      refresh: "r",
      expires: 1000 + 100_000,
      accountId: "fallback-acc",
    })
  })
})

describe("codexOAuthCredential", () => {
  test("未登录时抛错", async () => {
    const cred = codexOAuthCredential(new AuthStore(tmpPath))
    await expect(cred.authHeaders()).rejects.toThrow("未登录 Codex")
  })

  test("未过期直接产出头，不触发刷新", async () => {
    const store = new AuthStore(tmpPath)
    await store.set("codex", { access: "live", refresh: "r", expires: 10_000, accountId: "acc" })
    let refreshCalls = 0
    const cred = codexOAuthCredential(store, {
      now: () => 5_000,
      refresh: async () => {
        refreshCalls += 1
        return { access_token: "x", refresh_token: "y" }
      },
    })

    expect(await cred.authHeaders()).toEqual({
      Authorization: "Bearer live",
      "ChatGPT-Account-Id": "acc",
    })
    expect(refreshCalls).toBe(0)
  })

  test("过期则刷新、写回 store，并用新 access", async () => {
    const store = new AuthStore(tmpPath)
    await store.set("codex", {
      access: "old",
      refresh: "old-refresh",
      expires: 1_000,
      accountId: "acc",
    })
    const cred = codexOAuthCredential(store, {
      now: () => 9_999,
      refresh: async (refreshToken) => {
        expect(refreshToken).toBe("old-refresh")
        return { access_token: "new", refresh_token: "new-refresh", expires_in: 3600 }
      },
    })

    const headers = await cred.authHeaders()
    // 回退保留原 accountId；用 toEqual 避开对 Record 的下标访问
    expect(headers).toEqual({ Authorization: "Bearer new", "ChatGPT-Account-Id": "acc" })

    const persisted = await store.get("codex")
    expect(persisted?.access).toBe("new")
    expect(persisted?.refresh).toBe("new-refresh")
  })
})
