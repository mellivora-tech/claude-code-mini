import { Command } from "commander"
import type { Logger } from "pino"
import { createDiffCommand, type OutputWriter } from "./commands/diff-command"
import { createSchemaCommand } from "./commands/schema-command"
import { createTuiCommand } from "./commands/tui-command"
import { createLogger } from "./logger"

export type ProgramOptions = {
  readonly exitOverride?: boolean
  readonly logger?: Logger
  readonly writeError?: OutputWriter
  readonly writeOutput?: OutputWriter
}

export function createProgram(options: ProgramOptions = {}): Command {
  const logger = options.logger ?? createLogger()
  const writeOutput = options.writeOutput ?? ((text) => process.stdout.write(text))
  const writeError = options.writeError ?? ((text) => process.stderr.write(text))
  const program = new Command()

  program
    .name("claude-code-mini")
    .description("CLI and terminal tools for Claude Code Mini.")
    .version("0.1.0")
    .configureOutput({
      writeErr: writeError,
      writeOut: writeOutput,
    })

  if (options.exitOverride === true) {
    program.exitOverride()
  }

  program
    .addCommand(createDiffCommand({ logger, writeOutput }))
    .addCommand(createSchemaCommand({ logger, writeOutput }))
    .addCommand(createTuiCommand({ logger, writeOutput }))

  return program
}

export async function runCli(argv: readonly string[]): Promise<void> {
  await createProgram().parseAsync(argv)
}
