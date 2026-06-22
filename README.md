# 🚀 Git_AiReport

> 一款面向研发团队的桌面端 Git AI 报告生成工具，让提交记录自动变成日报、周报、月报、项目总结和开发日志。
>
> A desktop Git AI report generator for engineering teams. Turn commit history into daily reports, weekly reports, monthly reports, project summaries, and development logs.

![Electron](https://img.shields.io/badge/Electron-Desktop-47848F?logo=electron&logoColor=white)
![Vue](https://img.shields.io/badge/Vue-3-42b883?logo=vue.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178c6?logo=typescript&logoColor=white)
![AI](https://img.shields.io/badge/AI-Chat%20Completions-7c3aed)

---

## ✨ 项目简介 / Overview

**Git_AiReport** 是一个基于 **Electron + Vue 3 + TypeScript** 构建的桌面应用。它聚焦于一个非常实用的研发场景：将分散在 Git 提交中的工作轨迹，自动整理成可读、可编辑、可导出的工作报告。

通过读取本地 Git 仓库的提交记录，应用可以按分支、时间、作者、关键字、文件路径和提交类型进行筛选，再调用兼容 **Chat Completions** 的大模型接口，自动生成结构清晰的报告内容。界面采用类编辑器工作台布局，同时提供提交热力图、生成任务面板、富文本编辑器、本地工作区恢复、多语言切换、快捷并发控制和多格式导出能力。

**Git_AiReport** is a desktop application built with **Electron, Vue 3, and TypeScript**. It helps development teams convert local Git commit history into structured, editable, and exportable AI-generated reports. The app supports commit filtering, report generation, rich-text editing, workspace recovery, language switching, quick concurrency controls, and exports to Word, HTML, Markdown, and PDF.

---

## 🎯 核心价值 / Why Git_AiReport

- 📝 **少写重复报告**：从 Git 提交自动提取工作脉络，减少手写日报、周报的机械时间。
- 🧠 **更像人写的总结**：借助 AI 对提交进行归纳、分组和提炼，输出更适合汇报场景的表达。
- 🔍 **更容易复盘项目**：通过时间、模块、作者和文件路径筛选，快速追溯项目阶段性变化。
- 🌐 **多语言体验**：默认读取系统语言，并支持简体中文、English、日本語、한국어 手动切换。
- ⚡ **生成速度可控**：顶部工具栏可快速调整并发数，设置中可配置请求间隔、重试次数和退避时间。
- 📦 **输出格式灵活**：支持 Word、HTML、Markdown、PDF 导出，方便提交、存档或分享。
- 🔐 **本地优先**：直接读取本机仓库，工作区数据与 API 配置保存在本地。

---

## 🧰 功能特性 / Features

| 模块 / Module | 说明 / Description |
| --- | --- |
| 📁 仓库读取 | 选择本地 Git 仓库，读取分支和提交记录 / Select a local Git repository and read branches and commits |
| 🔎 智能筛选 | 按分支、日期、作者、关键字、分类、文件路径筛选 / Filter by branch, date, author, keyword, category, and file path |
| 🤖 AI 生成 | 调用 Chat Completions 兼容接口生成报告 / Generate reports through a Chat Completions-compatible API |
| 📅 多级报告 | 支持日报、周报、月报、总结、开发日志 / Daily, weekly, monthly, summary, and devlog reports |
| 🌐 多语言切换 | 默认跟随系统语言，支持简体中文、English、日本語、한국어 / Follow system language by default and support manual switching |
| ⚡ 并发任务 | 支持顶部快捷并发控制、请求间隔、失败重试和退避时间配置 / Quick concurrency control, request interval, retries, and backoff |
| 📊 可视化面板 | 提供统计指标、提交热力图和任务进度 / Show metrics, commit heatmap, and generation progress |
| ✍️ 富文本编辑 | 生成后可直接修改、加粗、列表、引用等 / Edit generated reports with rich-text controls |
| 📤 多格式导出 | 导出 Word、HTML、Markdown、PDF / Export to Word, HTML, Markdown, and PDF |
| 💾 本地恢复 | 保存工作区快照，重启后恢复上次记录 / Save workspace snapshots and restore previous sessions |

---

## 🖼️ 界面概览 / Interface

Git_AiReport 采用类 VS Code 的工作台布局，让常见操作都能在一个界面内完成：

- 左侧：仓库选择、生成类型、筛选器
- 顶部：报告生成按钮、语言切换、并发快捷控制
- 中间：报告列表、富文本阅读和编辑区
- 右侧：提交记录、提交热力图、文件变更摘要
- 底部：生成任务进度、成功和失败状态

---

## 🔄 工作流程 / Workflow

1. 📂 **选择仓库**：启动应用后，选择一个本地 Git 仓库。
2. 🎛️ **设置筛选**：根据需要选择分支、时间范围、作者、关键字或文件路径。
3. 🔑 **配置 AI**：填写 API Endpoint、API Key、模型名称、温度和 Token 上限。
4. 🌐 **选择语言**：默认跟随系统语言，也可以在顶部工具栏或设置窗口中手动切换语言。
5. ⚙️ **调整生成策略**：设置字数、读者、写作风格、关注点、并发数、请求间隔和重试次数。
6. ⚡ **优化速度**：在顶部工具栏直接调整并发数；并发越高生成越快，但可能触发模型服务限流。
7. 🤖 **生成报告**：生成指定类型报告，或使用“一键生成全部”。
8. ✍️ **编辑和导出**：在编辑区修改内容，然后导出为需要的格式。

---

## 🧪 AI 配置说明 / AI Configuration

应用支持兼容 Chat Completions 的 API 地址。如果填写的 Base URL 不包含 `/v1/chat/completions`，应用会尝试自动补全到对应路径。

| 配置项 / Option | 说明 / Description |
| --- | --- |
| Base URL / Endpoint | AI 服务地址，可填写基础地址或完整 chat completions 地址 |
| API Key | 模型服务的访问密钥 |
| Model | 模型名称，例如 `gpt-4.1-mini` 或其他兼容模型 |
| Temperature | 生成内容的发散程度 |
| Max Tokens | 单次请求允许返回的最大 token 数 |
| Extra Prompt | 额外提示词，可用于强化语气、结构或风险描述 |
| Language | 输出语言和界面语言，默认读取当前系统语言 |
| Concurrency | AI 生成并发数，默认 6，最高 24；可在顶部工具栏快速修改 |
| Request Interval | 请求错峰间隔，默认 0ms；遇到模型限流时可适当提高 |

> 💡 提示：API Key 和工作区信息保存在本机。请不要把包含真实密钥的本地配置文件提交到公共仓库。

---

## 🚄 生成速度 / Generation Performance

- 默认并发数为 **6**，最高可设置为 **24**。
- 默认请求间隔为 **0ms**，生成任务会尽快并发执行。
- 如果模型服务返回限流错误，可以降低并发数，或提高请求间隔和退避时间。
- 顶部工具栏提供语言和并发快捷控件；设置窗口中提供完整生成参数。

---

## 📤 导出能力 / Export Formats

- **Word (`.doc`)**：适合提交周报、月报或汇报材料。
- **HTML (`.html`)**：适合作为网页预览或内部文档嵌入。
- **Markdown (`.md`)**：适合写入项目文档、Wiki 或开发日志。
- **PDF (`.pdf`)**：适合稳定版式分享和存档。

---

## 🛠️ 技术栈 / Tech Stack

- **Electron**：桌面端应用容器
- **Electron Vite**：快速构建和开发体验
- **Vue 3**：前端界面和状态组织
- **TypeScript**：类型安全的业务逻辑
- **electron-builder**：跨平台打包和发布

---

## 📦 安装与运行 / Install & Run

### 安装依赖 / Install dependencies

```bash
npm install
```

### 本地开发 / Development

```bash
npm run dev
```

### 类型检查 / Type check

```bash
npm run typecheck
```

### 格式化 / Format

```bash
npm run format
```

### 构建 / Build

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

> 🧩 说明：Windows 环境可以完整构建 Windows 安装包；macOS 安装包需要在 macOS 上构建；Linux 的 AppImage/snap/deb 建议在 Linux 或 WSL 环境中构建。

---

## 📁 项目结构 / Project Structure

```text
Git_AiReport/
|-- src/
|   |-- main/          # Electron main process
|   |-- preload/       # Safe bridge between Electron and renderer
|   `-- renderer/      # Vue UI
|-- resources/         # App resources
|-- build/             # Build icons and packaging assets
|-- electron-builder.yml
|-- electron.vite.config.ts
|-- package.json
`-- README.md
```

---

## 🗺️ 适用场景 / Use Cases

- 每日或每周向主管汇报工作进展
- 从 Git 记录中整理版本迭代总结
- 为项目验收、复盘或交接生成材料
- 追踪某个分支、模块或作者的工作轨迹
- 将原始提交记录转成更易读的开发日志

---

## 📌 备注 / Notes

- 请确保本机已安装 Git，并且目标目录是有效的 Git 仓库。
- 首次使用前需要在应用内配置 AI 接口信息。
- 语言默认读取当前系统语言，也可以在顶部工具栏或设置窗口中手动切换。
- 并发数越高生成越快，但可能触发模型服务限流；遇到失败时建议降低并发或增加请求间隔。
- 生成结果会受提交信息质量和模型能力影响，建议导出前进行人工审阅和微调。

---

## 🌈 English Summary

Git_AiReport is a polished desktop tool for turning Git commit history into AI-assisted engineering reports. It reads local repositories, supports flexible filtering, generates several report levels, follows the system language by default, provides manual language switching, exposes quick concurrency controls, and exports final content to common document formats. It is especially useful for engineering status updates, sprint reviews, release summaries, project handovers, and development logs.
