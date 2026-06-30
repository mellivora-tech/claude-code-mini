import { describe, expect, test } from "bun:test"
import pino from "pino"
import { createProgram } from "../src/program"
import { parseJson } from "../src/json"
import { DiffOutputSchema } from "../src/schemas"
import { z } from "zod"

const JsonObjectSchema = z.record(z.unknown())

function createSilentLogger() {
  return pino({ enabled: false })
}

describe("createProgram", () => {
  test("prints structured diff JSON when diff command is invoked", async () => {
    // Given
    const output: string[] = []
    const program = createProgram({
      logger: createSilentLogger(),
      writeOutput: (text) => output.push(text),
    })

    // When
    await program.parseAsync(["diff", "hello", "hello world"], { from: "user" })

    // Then
    expect(output).toHaveLength(1)
    expect(DiffOutputSchema.parse(parseJson(output.join("")))).toEqual({
      chunks: [
        { operation: "equal", text: "hello" },
        { operation: "insert", text: " world" },
      ],
      stats: { deletions: 0, insertions: 6, unchanged: 5 },
    })
  })

  test("prints generated JSON schema when schema command is invoked", async () => {
    // Given
    const output: string[] = []
    const program = createProgram({
      logger: createSilentLogger(),
      writeOutput: (text) => output.push(text),
    })

    // When
    await program.parseAsync(["schema"], { from: "user" })

    // Then
    const schema = JsonObjectSchema.parse(parseJson(output.join("")))
    expect(schema["$ref"]).toBe("#/definitions/ClaudeCodeMiniSchemas")
  })

  test("prints bounded Ink output when tui command is invoked", async () => {
    // Given
    const output: string[] = []
    const program = createProgram({
      logger: createSilentLogger(),
      writeOutput: (text) => output.push(text),
    })

    // When
    await program.parseAsync(["tui", "--message", "Hello terminal"], { from: "user" })

    // Then
    expect(output).toHaveLength(1)
    expect(output.join("")).toContain("Hello terminal")
  })
})
