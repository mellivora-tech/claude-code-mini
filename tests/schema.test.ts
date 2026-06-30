import { describe, expect, test } from "bun:test"
import { z } from "zod"
import { parseJson } from "../src/json"
import { generateProjectJsonSchema } from "../src/schema-json"
import { DiffInputSchema, TuiInputSchema } from "../src/schemas"

const JsonObjectSchema = z.record(z.unknown())

describe("DiffInputSchema", () => {
  test("parses CLI input when cleanup is omitted", () => {
    // Given
    const rawInput = { before: "alpha", after: "alpha beta" }

    // When
    const input = DiffInputSchema.parse(rawInput)

    // Then
    expect(input).toEqual({ before: "alpha", after: "alpha beta", cleanup: true })
  })

  test("rejects unknown CLI fields when input includes extra properties", () => {
    // Given
    const rawInput = { before: "alpha", after: "beta", extra: "ignored" }

    // When
    const parseInput = () => DiffInputSchema.parse(rawInput)

    // Then
    expect(parseInput).toThrow()
  })
})

describe("TuiInputSchema", () => {
  test("parses CLI input when message is present", () => {
    // Given
    const rawInput = { message: "Hello terminal" }

    // When
    const input = TuiInputSchema.parse(rawInput)

    // Then
    expect(input).toEqual({ message: "Hello terminal" })
  })

  test("rejects CLI input when message is empty", () => {
    // Given
    const rawInput = { message: "" }

    // When
    const parseInput = () => TuiInputSchema.parse(rawInput)

    // Then
    expect(parseInput).toThrow()
  })
})

describe("generateProjectJsonSchema", () => {
  test("returns a draft seven schema with named definitions", () => {
    // Given
    const serializedSchema = JSON.stringify(generateProjectJsonSchema())

    // When
    const schema = JsonObjectSchema.parse(parseJson(serializedSchema))

    // Then
    expect(schema["$schema"]).toBe("http://json-schema.org/draft-07/schema#")
    expect(schema["$ref"]).toBe("#/definitions/ClaudeCodeMiniSchemas")
    expect(schema["definitions"]).toBeDefined()
    expect(serializedSchema).toContain("tuiInput")
  })
})
