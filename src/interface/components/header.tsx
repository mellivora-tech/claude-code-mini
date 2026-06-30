import { Box, Text } from "ink"

export function Header() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box borderStyle="round" borderColor="green" paddingX={1}>
        <Text bold color="green">
          ✻ claude-code-mini
        </Text>
        <Text color="gray"> · interface 层演示 TUI</Text>
      </Box>
      <Text color="gray">回车发送 · /exit 退出 · Ctrl+C 强制退出</Text>
    </Box>
  )
}
