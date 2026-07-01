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
