import { describe, expect, test } from "bun:test"
import { render } from "ink-testing-library"
import pino from "pino"
import { z } from "zod"
import { createTuiCommand } from "../src/commands/tui-command"
import { TuiApp } from "../src/tui/app"

const FrameSchema = z.string()

function createSilentLogger() {
  return pino({ enabled: false })
}

describe("TuiApp", () => {
  test("renders the provided message when component is mounted", () => {
    // Given
    const message = "Ship a bounded Ink view"

    // When
    const { lastFrame, unmount } = render(<TuiApp message={message} />)
    const frame = FrameSchema.parse(lastFrame())
    unmount()

    // Then
    expect(frame).toContain("Claude Code Mini")
    expect(frame).toContain(message)
  })
})

describe("createTuiCommand", () => {
  test("writes bounded Ink output when message option is provided", async () => {
    // Given
    const output: string[] = []
    const command = createTuiCommand({
      logger: createSilentLogger(),
      writeOutput: (text) => output.push(text),
    })

    // When
    await command.parseAsync(["--message", "Hello from Ink"], { from: "user" })

    // Then
    expect(output).toHaveLength(1)
    expect(output.join("")).toContain("Hello from Ink")
  })
})
