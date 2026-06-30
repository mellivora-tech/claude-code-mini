import { z } from "zod"

export const DiffOperationSchema = z.union([
  z.literal("delete"),
  z.literal("equal"),
  z.literal("insert"),
])

export const DiffChunkSchema = z
  .object({
    operation: DiffOperationSchema,
    text: z.string(),
  })
  .strict()

export const DiffStatsSchema = z
  .object({
    deletions: z.number().int().min(0),
    insertions: z.number().int().min(0),
    unchanged: z.number().int().min(0),
  })
  .strict()

export const DiffInputSchema = z
  .object({
    before: z.string().describe("Original text to compare from."),
    after: z.string().describe("New text to compare against."),
    cleanup: z.boolean().default(true).describe("Apply semantic cleanup to diff chunks."),
  })
  .strict()
  .describe("Inputs for the structured text diff command.")

export const DiffOutputSchema = z
  .object({
    chunks: z.array(DiffChunkSchema),
    stats: DiffStatsSchema,
  })
  .strict()
  .describe("Deterministic JSON-safe text diff output.")

export const TuiInputSchema = z
  .object({
    message: z.string().min(1).describe("Message to render in the terminal UI."),
  })
  .strict()
  .describe("Inputs for the bounded Ink terminal UI command.")

export const ProjectSchemaCatalogSchema = z
  .object({
    diffInput: DiffInputSchema,
    diffOutput: DiffOutputSchema,
    tuiInput: TuiInputSchema,
  })
  .strict()
  .describe("Claude Code Mini CLI schema catalog.")

export type DiffInput = z.infer<typeof DiffInputSchema>
export type DiffOutput = z.infer<typeof DiffOutputSchema>
export type DiffOperation = z.infer<typeof DiffOperationSchema>
export type TuiInput = z.infer<typeof TuiInputSchema>
