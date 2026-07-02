import type { ToolCall } from "../model/types"
import type { ToolContext } from "../tools/tool"

/**
 * 05 · 权限层 —— 横切于工具层之上的拦截闸。
 *
 * 危险操作（写文件、执行命令）在落地前需用户确认；只读操作（读文件、搜索）放行。
 * 不影响模型思考，只影响能否产生副作用。编排层在 tools.execute 之前调 check。
 */

export interface PermissionDecision {
  allowed: boolean
}

export interface PermissionGate {
  check(call: ToolCall, ctx: ToolContext): Promise<PermissionDecision>
}

/** 询问用户是否放行的回调（由界面层实现：弹确认框，返回 yes/no）。 */
export type ConfirmFn = (call: ToolCall) => Promise<boolean>

// 默认放行的只读工具白名单；不在其中的工具（bash/write_file 等）需确认。
const AUTO_ALLOW = new Set(["read_file", "grep"])

/**
 * 白名单 + 确认闸：白名单工具直接放行，其余走注入的 confirm 回调。
 * 未提供 confirm（如 CLI / 测试）时，非白名单工具一律拒绝，安全兜底。
 */
export function createPermissionGate(confirm?: ConfirmFn): PermissionGate {
  return {
    async check(call) {
      if (AUTO_ALLOW.has(call.name)) return { allowed: true }
      if (confirm === undefined) return { allowed: false }
      return { allowed: await confirm(call) }
    },
  }
}

/** 全放行闸（Phase E 打通前的占位 / 无需确认的场景）。 */
export function allowAllGate(): PermissionGate {
  return {
    async check() {
      return { allowed: true }
    },
  }
}
