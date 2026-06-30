export type Role = "user" | "assistant" | "system"

export interface Message {
  id: number
  role: Role
  content: string
}
