import { ToolRegistry } from "../registry"
import { bashTool } from "./bash"
import { grepTool } from "./grep"
import { readFileTool } from "./read-file"
import { writeFileTool } from "./write-file"

export { bashTool } from "./bash"
export { grepTool } from "./grep"
export { readFileTool } from "./read-file"
export { writeFileTool } from "./write-file"

/** 装配一个带全部内置工具的 ToolRegistry（组合根用）。 */
export function createBuiltinRegistry(): ToolRegistry {
  const registry = new ToolRegistry()
  registry.register(readFileTool)
  registry.register(writeFileTool)
  registry.register(bashTool)
  registry.register(grepTool)
  return registry
}
