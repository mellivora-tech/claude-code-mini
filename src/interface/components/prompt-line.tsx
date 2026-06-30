import { Box, Text } from "ink"

export function PromptLine({ value }: { value: string }) {
  return (
    <Box>
      <Text bold color="green">
        {"› "}
      </Text>
      <Text>{value}</Text>
      <Text color="gray">▍</Text>
    </Box>
  )
}
