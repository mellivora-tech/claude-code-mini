# Claude Code Mini

一个学习项目：用**目录结构本身**复刻 Claude Code 的架构。

脚手架来源于 `Claude Code Architecture.html`，从三个角度拆解同一套系统 ——
内部职责分层 / 扩展机制插槽 / 用户可感知模块。当前 `src/` 下为**纯占位脚手架**
（每层一个 README 说明职责，尚无实现代码）。

## 目录结构

```
src/
  index.ts             bin 入口（极薄）：new Bootstrap().run()
  bootstrap.ts         启动类 / 组合根：解析参数 → 装配依赖 → 拉起界面
  README.md            架构总览 + 三视角索引 + 速查表
  model/               模型层 — 纯 LLM，无状态
  tools/               工具层 — 读写文件 / bash / 搜索
  agent/               编排层 — 请求→工具→执行→回填 状态机
  context/             上下文管理层 — 摘要压缩 / 输出截断
  permission/          权限层 — 危险操作拦截确认
  prompt/              提示工程层 — 用自然语言编排各层
  interface/           界面层 — 终端 UI / 流式 / diff 展示
  extension/           横切扩展层 — 注册 + 延迟加载
    mcp/               MCP → 挂载工具层
    skill/             Skill → 挂载提示层
  memory/              记忆 — 三种时间尺度
    session/           会话内（= 上下文层，无持久化）
    project/           项目记忆 CLAUDE.md（强制全量加载）
    cross-session/     跨会话（RAG 式按需检索）
```

从 [`src/README.md`](src/README.md) 开始阅读。

## Setup

安装 Bun，然后安装依赖：

```sh
bun install
```

## 运行

在**真实终端**里启动 TUI（需要 TTY，IDE 的输出/调试面板不行）：

```sh
bun run start      # 等价于 bun run tui / bun run src/index.ts
```

进入后：打字回车发送（当前为 mock 回声），`/exit` 退出，Ctrl+C 强制退出。

启动链路：`src/index.ts` → `Bootstrap.run()` → `runTui()`（interface 层渲染）。
参数解析、接入真实模型层等都在 `src/bootstrap.ts` 里扩展。

## Stack

脚手架预留的工具链：

| Area | Tools |
| --- | --- |
| Runtime and package manager | Bun |
| Language | TypeScript 5.x |
| CLI | Commander |
| Data contracts | Zod, zod-to-json-schema |
| Diffing | diff-match-patch |
| Logging | pino |
| Tests | bun:test |
| TUI rendering | Ink |
