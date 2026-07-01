import { describe, expect, test } from "bun:test"
import type { ToolCall } from "../src/model/types"
import { allowAllGate, createPermissionGate } from "../src/permission/gate"

const ctx = { cwd: "." }
const call = (name: string): ToolCall => ({ id: "1", name, arguments: {} })

describe("PermissionGate", () => {
  test("白名单只读工具直接放行", async () => {
    const gate = createPermissionGate()
    expect((await gate.check(call("read_file"), ctx)).allowed).toBe(true)
    expect((await gate.check(call("grep"), ctx)).allowed).toBe(true)
  })

  test("无 confirm 时非白名单工具被拒（安全兜底）", async () => {
    const gate = createPermissionGate()
    expect((await gate.check(call("bash"), ctx)).allowed).toBe(false)
  })

  test("有 confirm 时非白名单工具走确认回调", async () => {
    const yes = createPermissionGate(async () => true)
    const no = createPermissionGate(async () => false)
    expect((await yes.check(call("write_file"), ctx)).allowed).toBe(true)
    expect((await no.check(call("write_file"), ctx)).allowed).toBe(false)
  })

  test("allowAllGate 一律放行", async () => {
    const gate = allowAllGate()
    expect((await gate.check(call("bash"), ctx)).allowed).toBe(true)
  })
})
