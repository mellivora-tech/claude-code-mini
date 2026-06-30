#!/usr/bin/env bun
import { runCli } from "./program"

if (import.meta.main) {
  await runCli(process.argv)
}

export { diffTexts, DiffOperationError } from "./diff"
export { createTuiCommand } from "./commands/tui-command"
export { formatJson, parseJson } from "./json"
export { createLogger } from "./logger"
export { createProgram, runCli } from "./program"
export { generateProjectJsonSchema } from "./schema-json"
export {
  DiffChunkSchema,
  DiffInputSchema,
  DiffOperationSchema,
  DiffOutputSchema,
  DiffStatsSchema,
  ProjectSchemaCatalogSchema,
  TuiInputSchema,
} from "./schemas"
export type { DiffInput, DiffOperation, DiffOutput, TuiInput } from "./schemas"
export { TuiApp } from "./tui/app"
export type { TuiAppProps } from "./tui/app"
