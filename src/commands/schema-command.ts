import { Command } from "commander"
import type { CommandDependencies } from "./diff-command"
import { formatJson } from "../json"
import { generateProjectJsonSchema } from "../schema-json"

export function createSchemaCommand(dependencies: CommandDependencies): Command {
  return new Command("schema")
    .description("Print the generated JSON schema for CLI data contracts.")
    .action(() => {
      const schema = generateProjectJsonSchema()

      dependencies.logger.debug({ command: "schema" }, "generated schema")
      dependencies.writeOutput(formatJson(schema))
    })
}
