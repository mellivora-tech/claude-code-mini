import { Command } from "commander"
import { renderToString } from "ink"
import { TuiInputSchema } from "../schemas"
import { TuiApp } from "../tui/app"
import type { CommandDependencies } from "./diff-command"

const TUI_RENDER_COLUMNS = 80

type TuiCommandOptions = {
  readonly message?: string
}

export function createTuiCommand(dependencies: CommandDependencies): Command {
  return new Command("tui")
    .description("Render a bounded Ink terminal view.")
    .requiredOption("--message <text>", "message to display")
    .action((options: TuiCommandOptions) => {
      const input = TuiInputSchema.parse({ message: options.message })
      const output = renderToString(<TuiApp message={input.message} />, {
        columns: TUI_RENDER_COLUMNS,
      })

      dependencies.logger.debug({ command: "tui" }, "rendered tui")
      dependencies.writeOutput(`${output}\n`)
    })
}
