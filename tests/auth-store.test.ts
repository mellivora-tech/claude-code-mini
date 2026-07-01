import { afterEach, describe, expect, test } from "bun:test"
import { rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AuthStore } from "../src/model/auth-store"

const tmpPath = join(tmpdir(), `ccm-authstore-${process.pid}.json`)

afterEach(async () => {
  await rm(tmpPath, { force: true })
})

describe("AuthStore", () => {
  test("set 后 get 能取回", async () => {
    const store = new AuthStore(tmpPath)
    await store.set("codex", { access: "a", refresh: "r", expires: 123, accountId: "acc" })

    expect(await store.get("codex")).toEqual({
      access: "a",
      refresh: "r",
      expires: 123,
      accountId: "acc",
    })
  })

  test("未知 provider 返回 undefined", async () => {
    const store = new AuthStore(tmpPath)
    expect(await store.get("nope")).toBeUndefined()
  })

  test("文件不存在时 all() 返回空对象", async () => {
    const store = new AuthStore(join(tmpdir(), `ccm-missing-${process.pid}.json`))
    expect(await store.all()).toEqual({})
  })
})
