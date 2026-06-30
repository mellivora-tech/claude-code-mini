import { describe, expect, test } from "bun:test"
import { diffTexts } from "../src/diff"

describe("diffTexts", () => {
  test("returns deterministic JSON-safe chunks when text changes", () => {
    // Given
    const input = { before: "hello", after: "hello world", cleanup: true }

    // When
    const output = diffTexts(input)

    // Then
    expect(output).toEqual({
      chunks: [
        { operation: "equal", text: "hello" },
        { operation: "insert", text: " world" },
      ],
      stats: { deletions: 0, insertions: 6, unchanged: 5 },
    })
  })

  test("counts deletions when text is removed", () => {
    // Given
    const input = { before: "hello world", after: "hello", cleanup: true }

    // When
    const output = diffTexts(input)

    // Then
    expect(output.stats).toEqual({ deletions: 6, insertions: 0, unchanged: 5 })
  })
})
