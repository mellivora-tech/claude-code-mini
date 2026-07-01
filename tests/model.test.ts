import { describe, expect, test } from "bun:test"
import { ModelService } from "../src/model/index"
import type { ModelProvider } from "../src/model/provider"
import { ModelRegistry } from "../src/model/registry"
import { Router } from "../src/model/router"
import type { ModelRequest, ModelResponse } from "../src/model/types"

/** 记录收到的请求、返回固定响应的假 provider——用来验证装配路径，不发网络。 */
function fakeProvider(
  id: string,
  response: ModelResponse,
): ModelProvider & { seen: ModelRequest[] } {
  const seen: ModelRequest[] = []
  return {
    id,
    seen,
    async complete(request: ModelRequest): Promise<ModelResponse> {
      seen.push(request)
      return response
    },
  }
}

function buildService(providers: ModelProvider[]) {
  const registry = new ModelRegistry()
  for (const p of providers) registry.registerProvider(p)
  registry.registerModel({ id: "model-a", provider: "prov-a", contextWindow: 1000 })
  registry.registerModel({ id: "model-b", provider: "prov-b", contextWindow: 2000 })
  const router = new Router({
    defaults: { main: "model-a", subagent: "model-b", cheap: "model-b" },
  })
  return new ModelService(registry, router)
}

describe("模型层装配", () => {
  test("registry 按模型 id 解析到正确的 provider", () => {
    const a = fakeProvider("prov-a", { type: "text", text: "A" })
    const b = fakeProvider("prov-b", { type: "text", text: "B" })
    const registry = new ModelRegistry()
    registry.registerProvider(a)
    registry.registerProvider(b)
    registry.registerModel({ id: "model-b", provider: "prov-b", contextWindow: 2000 })

    expect(registry.providerForModel("model-b").id).toBe("prov-b")
  })

  test("complete 分发到承载该模型的 provider", async () => {
    const a = fakeProvider("prov-a", { type: "text", text: "from A" })
    const b = fakeProvider("prov-b", { type: "text", text: "from B" })
    const service = buildService([a, b])

    const res = await service.complete({
      model: "model-b",
      messages: [{ role: "user", content: "hi" }],
    })

    expect(res).toEqual({ type: "text", text: "from B" })
    expect(b.seen).toHaveLength(1)
    expect(a.seen).toHaveLength(0)
  })

  test("completeFor 按用途路由后再分发", async () => {
    const a = fakeProvider("prov-a", { type: "text", text: "main" })
    const b = fakeProvider("prov-b", { type: "text", text: "sub" })
    const service = buildService([a, b])

    const res = await service.completeFor("subagent", [{ role: "user", content: "x" }])

    expect(res).toEqual({ type: "text", text: "sub" })
    expect(b.seen[0]?.model).toBe("model-b")
  })

  test("未知模型抛错", async () => {
    const service = buildService([fakeProvider("prov-a", { type: "text", text: "" })])
    await expect(service.complete({ model: "nope", messages: [] })).rejects.toThrow(
      "未知模型: nope",
    )
  })
})
