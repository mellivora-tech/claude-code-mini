import { Box, Text } from "ink"
import type { Message, Role } from "../types"

const ROLE_META: Record<Role, { label: string; color: string }> = {
  user: { label: "›", color: "cyan" },
  assistant: { label: "✻", color: "green" },
  system: { label: "·", color: "gray" },
}

export function MessageView({ messages }: { messages: readonly Message[] }) {
  if (messages.length === 0) {
    return (
      <Box marginBottom={1}>
        <Text color="gray">还没有对话，问点什么开始吧。</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {messages.map((message) => {
        const meta = ROLE_META[message.role]
        return (
          <Box key={message.id} marginBottom={1} flexDirection="column">
            {message.reasoning !== undefined && message.reasoning.length > 0 && (
              <ReasoningBlock text={message.reasoning} />
            )}
            <Box flexDirection="row">
              <Box marginRight={1}>
                <Text bold color={meta.color}>
                  {meta.label}
                </Text>
              </Box>
              <Box flexGrow={1}>
                <Text>{message.content}</Text>
              </Box>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

function ReasoningBlock({ text }: { text: string }) {
  return (
    <Box marginLeft={2} flexDirection="column">
      <Text color="gray" dimColor>
        ▼ 思考
      </Text>
      <Text color="gray" dimColor>
        {text}
      </Text>
    </Box>
  )
}
