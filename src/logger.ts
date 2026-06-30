import pino from "pino"
import type { Logger } from "pino"

const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const

export type LogLevel = (typeof LOG_LEVELS)[number]

export type LoggerOptions = {
  readonly level?: LogLevel
}

export function createLogger(options: LoggerOptions = {}): Logger {
  return pino(
    {
      level: options.level ?? "warn",
    },
    pino.destination(2),
  )
}
