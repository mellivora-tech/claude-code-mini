import DiffMatchPatch from "diff-match-patch"
import type { DiffInput, DiffOperation, DiffOutput } from "./schemas"

const DIFF_MATCH_PATCH_OPERATION = {
  delete: -1,
  equal: 0,
  insert: 1,
} as const

function toDiffOperation(operation: number): DiffOperation {
  switch (operation) {
    case DIFF_MATCH_PATCH_OPERATION.delete:
      return "delete"
    case DIFF_MATCH_PATCH_OPERATION.equal:
      return "equal"
    case DIFF_MATCH_PATCH_OPERATION.insert:
      return "insert"
    default:
      throw new DiffOperationError(operation)
  }
}

function countByOperation(chunks: DiffOutput["chunks"], operation: DiffOperation): number {
  return chunks
    .filter((chunk) => chunk.operation === operation)
    .reduce((total, chunk) => total + chunk.text.length, 0)
}

export class DiffOperationError extends Error {
  readonly name = "DiffOperationError"

  constructor(readonly operation: number) {
    super(`Unexpected diff-match-patch operation: ${operation}`)
  }
}

export function diffTexts(input: DiffInput): DiffOutput {
  const diffEngine = new DiffMatchPatch()
  const rawChunks = diffEngine.diff_main(input.before, input.after)

  if (input.cleanup) {
    diffEngine.diff_cleanupSemantic(rawChunks)
  }

  const chunks = rawChunks.map(([operation, text]) => ({
    operation: toDiffOperation(operation),
    text,
  }))

  return {
    chunks,
    stats: {
      deletions: countByOperation(chunks, "delete"),
      insertions: countByOperation(chunks, "insert"),
      unchanged: countByOperation(chunks, "equal"),
    },
  }
}
