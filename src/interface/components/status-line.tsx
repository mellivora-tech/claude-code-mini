import { Box, Text } from "ink"
import { useEffect, useState } from "react"

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

export function StatusLine() {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((current) => (current + 1) % FRAMES.length)
    }, 80)
    return () => clearInterval(timer)
  }, [])

  return (
    <Box>
      <Text color="green">{FRAMES[frame] ?? ""}</Text>
      <Text color="gray"> 思考中…</Text>
    </Box>
  )
}
