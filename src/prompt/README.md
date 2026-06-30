# 06 · 提示工程层 · SYSTEM PROMPT

用自然语言「编程」前面所有层的行为 —— 工具怎么用、规范是什么、何时该问用户。
调优重头戏。

## 职责
- 组装系统提示词，约束模型行为
- 注入项目记忆、Skill 索引等信息源

## 与其他层的关系
- 塑造 [`model`](../model/) 的行为
- [`extension/skill`](../extension/skill/) 的 SKILL.md 索引挂载到本层
- 项目记忆 [`../memory/project`](../memory/project/)（CLAUDE.md）是本层固定输入源
