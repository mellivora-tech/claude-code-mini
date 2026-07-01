import { describe, expect, test } from "bun:test"
import { render } from "ink-testing-library"
import { SelectPrompt } from "../src/interface/prompt"

const ESC = String.fromCharCode(27)
const DOWN = `${ESC}[B`
const UP = `${ESC}[A`
const ENTER = "\r"

const tick = () => new Promise((resolve) => setTimeout(resolve, 10))

function options() {
  return [
    { label: "A", value: "a" },
    { label: "B", value: "b" },
    { label: "C", value: "c" },
  ]
}

describe("SelectPrompt", () => {
  test("渲染 message 与所有选项", () => {
    const { lastFrame } = render(
      <SelectPrompt message="选择：" options={options()} onSelect={() => {}} />,
    )
    const frame = lastFrame() ?? ""
    expect(frame).toContain("选择：")
    expect(frame).toContain("A")
    expect(frame).toContain("C")
  })

  test("向下移动后回车选中第二项", async () => {
    const selected: string[] = []
    const { stdin } = render(
      <SelectPrompt message="m" options={options()} onSelect={(v) => selected.push(v)} />,
    )
    stdin.write(DOWN)
    await tick()
    stdin.write(ENTER)
    await tick()
    expect(selected).toEqual(["b"])
  })

  test("向上从首项回绕到末项", async () => {
    const selected: string[] = []
    const { stdin } = render(
      <SelectPrompt message="m" options={options()} onSelect={(v) => selected.push(v)} />,
    )
    stdin.write(UP)
    await tick()
    stdin.write(ENTER)
    await tick()
    expect(selected).toEqual(["c"])
  })
})
