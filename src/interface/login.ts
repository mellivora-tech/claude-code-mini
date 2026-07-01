/**
 * 登录能力的接口层契约（provider 无关）。
 *
 * 组合根（bootstrap）把具体登录逻辑（loginCodex + AuthStore）包装成 LoginOption，
 * 注入给界面层；界面层只认 label + run(onInfo)，不知道 codex/openai 的细节。
 * 同一份 LoginService 也被 CLI 复用。
 */
export interface LoginOption {
  label: string
  /** 执行登录；onInfo 用于把过程信息（授权 URL、设备码等）回报给调用方。resolve 为成功文案。 */
  run(onInfo: (message: string) => void): Promise<string>
}

export interface LoginService {
  options: LoginOption[]
}
