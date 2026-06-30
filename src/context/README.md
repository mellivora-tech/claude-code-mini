# 04 · 上下文管理层 · CONTEXT WINDOW

代码库远超上下文窗口，本层负责历史摘要压缩、工具输出截断 ——
解决「有限窗口装无限信息」。

## 职责
- 历史消息的摘要压缩（compaction）
- 工具输出的截断（truncation）
- 维护当前会话的上下文窗口

## 与其他层的关系
- 服务于 [`agent`](../agent/) 的每一轮请求
- 本层本身即「会话内记忆」，见 [`../memory/session`](../memory/session/)
