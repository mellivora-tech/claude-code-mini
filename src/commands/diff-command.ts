import { Command } from "commander"
import type { Logger } from "pino"
import { diffTexts } from "../diff"
import { formatJson } from "../json"
import { DiffInputSchema, DiffOutputSchema } from "../schemas"

export type OutputWriter = (text: string) => void

export type CommandDependencies = {
  readonly logger: Logger
  readonly writeOutput: OutputWriter
}

type DiffCommandOptions = {
  readonly cleanup?: boolean
}

export function createDiffCommand(dependencies: CommandDependencies): Command {
  return new Command("diff")
    .description("Print a structured JSON diff between two strings.")
    .argument("<before>", "original text")
    .argument("<after>", "new text")
    .option("--no-cleanup", "skip semantic diff cleanup")
    .action((before: string, after: string, options: DiffCommandOptions) => {
      const input = DiffInputSchema.parse({
        before,
        after,
        cleanup: options.cleanup,
      })
      const output = DiffOutputSchema.parse(diffTexts(input))

      dependencies.logger.debug({ command: "diff", stats: output.stats }, "computed diff")
      dependencies.writeOutput(formatJson(output))
    })
}
