# 07 · 界面层 · INTERFACE

终端 UI、流式输出、diff 展示。离用户最近，不涉及核心智能逻辑。

## 职责
- 终端交互界面
- 流式输出渲染
- diff 展示、工具调用过程可视化

## 与其他层的关系
- 展示 [`agent`](../agent/) 的执行过程
- 承载 [`permission`](../permission/) 的确认交互

## 当前实现（Ink TUI）

类 Claude Code 的终端界面，用 Ink + React 写成。运行（启动入口在 `src/index.ts` → `Bootstrap`）：

```sh
bun run start
```

文件：

| 文件 | 作用 |
| --- | --- |
| `run.tsx` | 界面层入口：`runTui(options)`，渲染 `<App />` 并等待退出 |
| `app.tsx` | 主组件：消息状态、输入捕获（useInput）、提交流程 |
| `responder.ts` | `Responder` 契约 + mock 回声实现，界面与模型层解耦 |
| `types.ts` | `Message` / `Role` 类型 |
| `components/header.tsx` | 顶部标题栏 |
| `components/message-view.tsx` | 对话历史（按角色着色） |
| `components/prompt-line.tsx` | 输入行 + 光标 |
| `components/status-line.tsx` | 思考中 spinner |

交互：回车发送，`/exit` 或 `/quit` 退出，Ctrl+C 强制退出。

模型层尚未实现，当前由 [`bootstrap`](../bootstrap.ts) 注入 `createEchoResponder()` 返回占位回复。
接入真模型 / agent loop 时，只需实现 `Responder` 接口并在 bootstrap 里改注入，界面代码无需改动。

