import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type GitCommit = {
  hash: string
  shortHash: string
  author: string
  email: string
  date: string
  subject: string
  body: string
  files: string[]
}

type GitReadOptions = {
  repositoryPath: string
  branch?: string
  since?: string
  until?: string
  author?: string
  keyword?: string
}

type BranchInfo = {
  current: string
  branches: string[]
}

type AiConfig = {
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
}

type AiGeneratePayload = {
  config: AiConfig
  systemPrompt: string
  userPrompt: string
}

type ExportFormat = 'doc' | 'html' | 'md' | 'txt' | 'pdf'

type ExportPayload = {
  title: string
  html: string
  markdown?: string
  text?: string
  format: ExportFormat
}

const api = {
  selectRepository: (): Promise<string | null> => ipcRenderer.invoke('git:select-repository'),
  readBranches: (repositoryPath: string): Promise<BranchInfo> => ipcRenderer.invoke('git:read-branches', repositoryPath),
  readCommits: (options: GitReadOptions): Promise<GitCommit[]> => ipcRenderer.invoke('git:read-commits', options),
  generateAiReport: (payload: AiGeneratePayload): Promise<string> => ipcRenderer.invoke('ai:generate-report', payload),
  testAiConfig: (config: AiConfig): Promise<string> => ipcRenderer.invoke('ai:test-config', config),
  saveAiConfig: (config: AiConfig): Promise<void> => ipcRenderer.invoke('config:save-ai', config),
  loadAiConfig: (): Promise<Partial<AiConfig> | null> => ipcRenderer.invoke('config:load-ai'),
  saveWorkspace: (data: unknown): Promise<void> => ipcRenderer.invoke('workspace:save', data),
  loadWorkspace: (): Promise<unknown | null> => ipcRenderer.invoke('workspace:load'),
  exportReport: (payload: ExportPayload): Promise<string | null> => ipcRenderer.invoke('report:export', payload),
  showItemInFolder: (filePath: string): Promise<void> => ipcRenderer.invoke('shell:show-item', filePath)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
