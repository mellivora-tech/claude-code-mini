import { zodToJsonSchema } from "zod-to-json-schema"
import { ProjectSchemaCatalogSchema } from "./schemas"

export function generateProjectJsonSchema() {
  return zodToJsonSchema(ProjectSchemaCatalogSchema, {
    name: "ClaudeCodeMiniSchemas",
    target: "jsonSchema7",
  })
}
