import { afterEach, describe, expect, test } from "bun:test"
import { rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AuthStore } from "../src/model/auth-store"
import { storedApiKeyCredential } from "../src/model/credential"

const tmpPath = join(tmpdir(), `ccm-cred-${process.pid}.json`)

afterEach(async () => {
  await rm(tmpPath, { force: true })
})

describe("AuthStore API key", () => {
  test("setApiKey/getApiKey 往返", async () => {
    const store = new AuthStore(tmpPath)
    await store.setApiKey("kimi", "sk-xyz")
    expect(await store.getApiKey("kimi")).toBe("sk-xyz")
  })

  test("OAuth 与 API key 互不串味", async () => {
    const store = new AuthStore(tmpPath)
    await store.set("codex", { access: "a", refresh: "r", expires: 1 })
    await store.setApiKey("kimi", "sk-1")
    expect(await store.getApiKey("codex")).toBeUndefined() // codex 是 OAuth
    expect(await store.get("kimi")).toBeUndefined() // kimi 是 API key
  })
})

describe("storedApiKeyCredential", () => {
  test("从 store 读取，产出 Bearer 头", async () => {
    const store = new AuthStore(tmpPath)
    await store.setApiKey("kimi", "sk-abc")
    const cred = storedApiKeyCredential(store, "kimi")
    expect(await cred.authHeaders()).toEqual({ Authorization: "Bearer sk-abc" })
    expect(await cred.isConfigured?.()).toBe(true)
  })

  test("store 无 key、无 env 时未配置并抛错", async () => {
    const store = new AuthStore(tmpPath)
    const cred = storedApiKeyCredential(store, "kimi", "CCM_NONEXISTENT_ENV")
    expect(await cred.isConfigured?.()).toBe(false)
    await expect(cred.authHeaders()).rejects.toThrow("未配置")
  })
})
