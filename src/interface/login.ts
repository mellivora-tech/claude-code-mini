/**
 * 登录能力的接口层契约（provider 无关）。
 *
 * 组合根把具体登录逻辑包装成 LoginOption 注入界面；界面层只认 label + run(ctx)。
 * ctx 让登录过程既能回报信息（OAuth 的授权 URL/设备码），也能向用户索取文本输入
 * （API key 登录时粘贴 key）。同一份 LoginService 也被 CLI 复用。
 */
export interface LoginContext {
  /** 回报过程信息（授权 URL、设备码等）。 */
  info(message: string): void
  /** 向用户索取一行文本（如粘贴 API key），resolve 为用户输入。 */
  prompt(label: string): Promise<string>
}

export interface LoginOption {
  label: string
  /** 执行登录。resolve 为成功文案。 */
  run(ctx: LoginContext): Promise<string>
}

export interface LoginService {
  options: LoginOption[]
}
