import { describe, expect, test } from "bun:test"
import { render } from "ink-testing-library"
import { App } from "../src/interface/app"
import type { Command } from "../src/interface/command"
import type { Responder } from "../src/interface/responder"

const ENTER = "\r"
const tick = () => new Promise((resolve) => setTimeout(resolve, 20))

const silentResponder: Responder = { respond: async () => "ok" }

describe("App 斜杠命令分发", () => {
  test("按名字找到命令并运行，print 渲进界面", async () => {
    let ran = false
    const ping: Command = {
      name: "ping",
      run: async (ctx) => {
        ran = true
        ctx.print("pong")
      },
    }
    const { stdin, lastFrame } = render(<App responder={silentResponder} commands={[ping]} />)
    stdin.write("/ping")
    await tick()
    stdin.write(ENTER)
    await tick()

    expect(ran).toBe(true)
    expect(lastFrame() ?? "").toContain("pong")
  })

  test("未知命令给出提示", async () => {
    const { stdin, lastFrame } = render(<App responder={silentResponder} commands={[]} />)
    stdin.write("/nope")
    await tick()
    stdin.write(ENTER)
    await tick()
    expect(lastFrame() ?? "").toContain("未知命令")
  })
})
