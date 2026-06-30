import { Box, Text } from "ink"

const TUI_COPY = {
  divider: "----------------",
  title: "Claude Code Mini",
} as const

export type TuiAppProps = {
  readonly message: string
}

export function TuiApp({ message }: TuiAppProps) {
  return (
    <Box flexDirection="column">
      <Text bold>{TUI_COPY.title}</Text>
      <Text dimColor>{TUI_COPY.divider}</Text>
      <Text>{message}</Text>
    </Box>
  )
}
