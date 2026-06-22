import { ElectronAPI } from '@electron-toolkit/preload'

export type GitCommit = {
  hash: string
  shortHash: string
  author: string
  email: string
  date: string
  subject: string
  body: string
  files: string[]
}

export type GitReadOptions = {
  repositoryPath: string
  branch?: string
  since?: string
  until?: string
  author?: string
  keyword?: string
}

export type BranchInfo = {
  current: string
  branches: string[]
}

export type AiConfig = {
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
}

export type AiGeneratePayload = {
  config: AiConfig
  systemPrompt: string
  userPrompt: string
}

export type ExportFormat = 'doc' | 'html' | 'md' | 'txt' | 'pdf'

export type ExportPayload = {
  title: string
  html: string
  markdown?: string
  text?: string
  format: ExportFormat
}

export type AiReportApi = {
  selectRepository: () => Promise<string | null>
  readBranches: (repositoryPath: string) => Promise<BranchInfo>
  readCommits: (options: GitReadOptions) => Promise<GitCommit[]>
  generateAiReport: (payload: AiGeneratePayload) => Promise<string>
  testAiConfig: (config: AiConfig) => Promise<string>
  saveAiConfig: (config: AiConfig) => Promise<void>
  loadAiConfig: () => Promise<Partial<AiConfig> | null>
  saveWorkspace: (data: unknown) => Promise<void>
  loadWorkspace: () => Promise<unknown | null>
  exportReport: (payload: ExportPayload) => Promise<string | null>
  showItemInFolder: (filePath: string) => Promise<void>
  getSystemLocale: () => Promise<string>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AiReportApi
  }
}
