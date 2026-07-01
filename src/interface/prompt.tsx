import { Box, render, Text, useInput } from "ink"
import { useState } from "react"

export interface SelectOption<T> {
  label: string
  value: T
}

export interface SelectPromptProps<T> {
  message: string
  options: SelectOption<T>[]
  onSelect: (value: T) => void
}

/**
 * 极简单选列表：上/下移动光标，回车确认。与 interface/app.tsx 的手写 useInput 同风格。
 * 只负责渲染 + 选择，不管挂载生命周期（交给 promptSelect）。
 */
export function SelectPrompt<T>({ message, options, onSelect }: SelectPromptProps<T>) {
  const [index, setIndex] = useState(0)

  useInput((_input, key) => {
    if (key.upArrow) {
      setIndex((i) => (i - 1 + options.length) % options.length)
    } else if (key.downArrow) {
      setIndex((i) => (i + 1) % options.length)
    } else if (key.return) {
      const option = options[index]
      if (option) onSelect(option.value)
    }
  })

  return (
    <Box flexDirection="column">
      <Text>{message}</Text>
      {options.map((option, i) => (
        <Text key={option.label} color={i === index ? "cyan" : "gray"}>
          {i === index ? "› " : "  "}
          {option.label}
        </Text>
      ))}
    </Box>
  )
}

/**
 * 渲染一个单选提示，用户选定后卸载 Ink 并 resolve 选中的值。
 * 卸载后终端恢复，便于随后跑基于 console 的流程（如 OAuth 登录）。
 */
export function promptSelect<T>(message: string, options: SelectOption<T>[]): Promise<T> {
  return new Promise<T>((resolve) => {
    let instance: ReturnType<typeof render> | undefined
    instance = render(
      <SelectPrompt
        message={message}
        options={options}
        onSelect={(value) => {
          instance?.unmount()
          resolve(value)
        }}
      />,
    )
  })
}

export interface TextPromptProps {
  label: string
  onSubmit: (value: string) => void
  onCancel?: () => void
}

/**
 * 极简单行文本输入：录入字符（支持整段粘贴）、退格删除、回车提交、Esc 取消。
 * 自带 useInput，与 SelectPrompt 一样在 App 的某个模式下接管按键。
 */
export function TextPrompt({ label, onSubmit, onCancel }: TextPromptProps) {
  const [value, setValue] = useState("")

  useInput((input, key) => {
    if (key.return) {
      onSubmit(value)
      return
    }
    if (key.escape) {
      onCancel?.()
      return
    }
    if (key.backspace || key.delete) {
      setValue((current) => current.slice(0, -1))
      return
    }
    // 普通输入；整段粘贴会作为一个 input chunk 到达，直接拼接即可。
    if (input.length > 0 && !key.ctrl && !key.meta) {
      setValue((current) => current + input)
    }
  })

  return (
    <Box flexDirection="column">
      <Text>{label}</Text>
      <Text color="cyan">{`› ${value}`}</Text>
    </Box>
  )
}
