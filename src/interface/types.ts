export type Role = "user" | "assistant" | "system"

export interface Message {
  id: number
  role: Role
  content: string
  /** 模型思考过程（原生 reasoning），可选，界面可折叠展示。 */
  reasoning?: string
  /** true 表示界面提示（问候/命令反馈/错误）,不作为模型对话历史发送。 */
  meta?: boolean
}
