# 02 · 工具层 · TOOL LAYER

模型唯一能「伸手」碰真实世界的接口 —— 读写文件、执行 bash、搜索代码。
模型本身永不直接操作系统。

## 职责
- 暴露一组工具的 schema 给 [`model`](../model/)
- 接收模型的工具调用请求，执行并产生真实副作用，返回结果

## 与其他层的关系
- 工具调用先经 [`permission`](../permission/) 拦截，危险操作需确认
- 由 [`agent`](../agent/) 统一调度执行
- 外部工具通过 [`extension/mcp`](../extension/mcp/) 注册进本层工具列表
