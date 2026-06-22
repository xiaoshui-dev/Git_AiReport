import { app, shell, BrowserWindow, ipcMain, dialog, safeStorage } from 'electron'
import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { promisify } from 'util'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

const execFileAsync = promisify(execFile)

const FIELD_SEPARATOR = '\u001f'
const RECORD_SEPARATOR = '\u001e'
const SECURE_CONFIG_FILE = 'secure-ai-config.bin'
const WORKSPACE_FILE = 'workspace.json'

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
  requestId?: string
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

const aiRequestControllers = new Map<string, AbortController>()

async function readGitBranches(repositoryPath: string): Promise<BranchInfo> {
  assertRepositoryPath(repositoryPath)

  const [{ stdout: branchesStdout }, { stdout: currentStdout }] = await Promise.all([
    execFileAsync('git', ['-C', repositoryPath, 'branch', '--all', '--format=%(refname:short)'], {
      maxBuffer: 1024 * 1024
    }),
    execFileAsync('git', ['-C', repositoryPath, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      maxBuffer: 1024 * 1024
    })
  ])

  const branches = branchesStdout
    .split(/\r?\n/)
    .map((branch) => branch.trim())
    .filter((branch) => branch && !branch.includes('HEAD ->'))
    .map((branch) => branch.replace(/^remotes\//, ''))
    .filter(Boolean)
  const uniqueBranches = [...new Set(branches)]

  return {
    current: currentStdout.trim(),
    branches: uniqueBranches
  }
}

async function readGitCommits(options: GitReadOptions): Promise<GitCommit[]> {
  const { repositoryPath, branch, since, until, author, keyword } = options
  assertRepositoryPath(repositoryPath)

  const args = [
    '-C',
    repositoryPath,
    'log',
    '--date=short',
    `--pretty=format:${RECORD_SEPARATOR}%H${FIELD_SEPARATOR}%h${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%ae${FIELD_SEPARATOR}%ad${FIELD_SEPARATOR}%s${FIELD_SEPARATOR}%b`
  ]

  const revision = await resolveGitRevision(repositoryPath, branch)
  if (revision) args.push(revision)
  if (since) args.push(`--since=${since}`)
  if (until) args.push(`--until=${until}`)
  if (author) args.push(`--author=${author}`)
  if (keyword) args.push(`--grep=${keyword}`, '--regexp-ignore-case')

  args.push('--name-only', '--')

  const { stdout } = await execFileAsync('git', args, { maxBuffer: 1024 * 1024 * 32 })

  return stdout
    .split(RECORD_SEPARATOR)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [metadata = '', ...fileLines] = record.split(/\r?\n/)
      const [hash, shortHash, authorName, email, date, subject, body = ''] =
        metadata.split(FIELD_SEPARATOR)

      return {
        hash,
        shortHash,
        author: authorName,
        email,
        date,
        subject,
        body: body.trim(),
        files: fileLines.map((file) => file.trim()).filter(Boolean)
      }
    })
}

async function resolveGitRevision(repositoryPath: string, branch?: string): Promise<string> {
  const trimmed = branch?.trim()
  if (!trimmed) return ''

  const candidates = [trimmed]
  if (!trimmed.startsWith('origin/')) candidates.push(`origin/${trimmed}`)
  if (trimmed.startsWith('remotes/')) candidates.push(trimmed.replace(/^remotes\//, ''))

  for (const candidate of [...new Set(candidates)]) {
    try {
      await execFileAsync(
        'git',
        ['-C', repositoryPath, 'rev-parse', '--verify', `${candidate}^{commit}`],
        { maxBuffer: 1024 * 1024 }
      )
      return candidate
    } catch {
      // Try the next candidate.
    }
  }

  return ''
}

async function generateAiReport(payload: AiGeneratePayload): Promise<string> {
  const { config, requestId, systemPrompt, userPrompt } = payload
  if (!config.baseUrl.trim()) throw new Error('API endpoint is required')
  if (!config.model.trim()) throw new Error('Model name is required')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (config.apiKey.trim()) {
    headers.Authorization = `Bearer ${config.apiKey.trim()}`
  }

  const endpoint = normalizeChatCompletionsUrl(config.baseUrl)
  const controller = new AbortController()
  if (requestId) aiRequestControllers.set(requestId, controller)

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model.trim(),
        temperature: Number(config.temperature),
        max_tokens: Number(config.maxTokens),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      })
    })
  } catch (error) {
    if (controller.signal.aborted) throw new Error('AI request canceled')
    throw error
  } finally {
    if (requestId) aiRequestControllers.delete(requestId)
  }

  const text = await response.text()
  let data: unknown

  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }

  if (!response.ok) {
    const apiMessage = extractApiError(data)
    const message =
      response.status === 404
        ? apiMessage || `API request failed with 404. Checked endpoint: ${endpoint}`
        : apiMessage || `API request failed with ${response.status}. Checked endpoint: ${endpoint}`
    throw new Error(message)
  }

  const content = extractAiContent(data)
  if (!content) throw new Error('No content returned from model')
  return content
}

function cancelAiRequests(requestIdPrefix: string): number {
  let canceled = 0
  for (const [requestId, controller] of aiRequestControllers.entries()) {
    if (requestId === requestIdPrefix || requestId.startsWith(`${requestIdPrefix}:`)) {
      controller.abort()
      aiRequestControllers.delete(requestId)
      canceled += 1
    }
  }
  return canceled
}

async function testAiConfig(config: AiConfig): Promise<string> {
  const content = await generateAiReport({
    config,
    systemPrompt: 'You are a connection test assistant. Reply with OK only.',
    userPrompt: 'Return OK.'
  })
  return content.trim() || 'OK'
}

async function saveSecureAiConfig(config: AiConfig): Promise<void> {
  const filePath = getUserDataPath(SECURE_CONFIG_FILE)
  await mkdir(dirname(filePath), { recursive: true })
  const payload = JSON.stringify(config)

  if (safeStorage.isEncryptionAvailable()) {
    await writeFile(filePath, safeStorage.encryptString(payload))
  } else {
    await writeFile(filePath, Buffer.from(payload, 'utf8'))
  }
}

async function loadSecureAiConfig(): Promise<Partial<AiConfig> | null> {
  const filePath = getUserDataPath(SECURE_CONFIG_FILE)
  if (!existsSync(filePath)) return null

  const buffer = await readFile(filePath)
  try {
    const payload = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(buffer)
      : buffer.toString('utf8')
    return JSON.parse(payload) as Partial<AiConfig>
  } catch {
    return null
  }
}

async function saveWorkspaceData(data: unknown): Promise<void> {
  const filePath = getUserDataPath(WORKSPACE_FILE)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
}

async function loadWorkspaceData(): Promise<unknown | null> {
  const filePath = getUserDataPath(WORKSPACE_FILE)
  if (!existsSync(filePath)) return null
  return JSON.parse(await readFile(filePath, 'utf8')) as unknown
}

async function exportReport(payload: ExportPayload): Promise<string | null> {
  const safeTitle = sanitizeFileName(payload.title || 'AI Report')
  const extension = payload.format
  const filters = [{ name: `${payload.format.toUpperCase()} File`, extensions: [extension] }]

  const result = await dialog.showSaveDialog({
    title: 'Export Report',
    defaultPath: `${safeTitle}.${extension}`,
    filters
  })

  if (result.canceled || !result.filePath) return null

  if (payload.format === 'pdf') {
    await exportPdf(result.filePath, payload.title, payload.html)
    return result.filePath
  }

  const contentByFormat: Record<Exclude<ExportFormat, 'pdf'>, string> = {
    doc: buildWordHtml(payload.title, payload.html),
    html: buildStandaloneHtml(payload.title, payload.html),
    md: payload.markdown ?? htmlToText(payload.html),
    txt: payload.text ?? htmlToText(payload.html)
  }

  await writeFile(result.filePath, contentByFormat[payload.format], 'utf8')
  return result.filePath
}

async function exportPdf(filePath: string, title: string, html: string): Promise<void> {
  const pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true
    }
  })

  try {
    await pdfWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(buildStandaloneHtml(title, html))}`
    )
    const pdf = await pdfWindow.webContents.printToPDF({ printBackground: true })
    await writeFile(filePath, pdf)
  } finally {
    pdfWindow.close()
  }
}

function buildWordHtml(title: string, html: string): string {
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title>${documentStyle()}</head>
<body>${html}</body></html>`
}

function buildStandaloneHtml(title: string, html: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>${documentStyle()}</head><body>${html}</body></html>`
}

function documentStyle(): string {
  return `<style>body{font-family:"Microsoft YaHei",Arial,sans-serif;line-height:1.6;color:#1f2933;padding:32px;}h1,h2,h3{color:#111827;}li{margin:4px 0;}blockquote{border-left:4px solid #246bfe;padding-left:12px;color:#374151;background:#f5f8ff;}</style>`
}

function normalizeChatCompletionsUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim()
  if (!trimmed) return trimmed

  try {
    const url = new URL(trimmed)
    const normalizedPath = url.pathname.replace(/\/+$/, '')
    if (/\/chat\/completions$/i.test(normalizedPath)) return url.toString()
    url.pathname = normalizedPath.endsWith('/v1')
      ? `${normalizedPath}/chat/completions`
      : `${normalizedPath}/v1/chat/completions`
    return url.toString()
  } catch {
    const normalized = trimmed.replace(/\/+$/, '')
    if (/\/chat\/completions$/i.test(normalized)) return normalized
    if (/\/v1$/i.test(normalized)) return `${normalized}/chat/completions`
    return `${normalized}/v1/chat/completions`
  }
}

function extractAiContent(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const maybe = data as {
    choices?: Array<{ message?: { content?: string }; text?: string }>
    output_text?: string
  }

  return maybe.choices?.[0]?.message?.content ?? maybe.choices?.[0]?.text ?? maybe.output_text ?? ''
}

function extractApiError(data: unknown): string {
  if (!data || typeof data !== 'object') return typeof data === 'string' ? data : ''
  const maybe = data as { error?: { message?: string } | string; message?: string }
  if (typeof maybe.error === 'string') return maybe.error
  return maybe.error?.message ?? maybe.message ?? ''
}

function assertRepositoryPath(repositoryPath: string): void {
  if (!repositoryPath || !existsSync(repositoryPath)) {
    throw new Error('Repository path does not exist')
  }
}

function getUserDataPath(fileName: string): string {
  return join(app.getPath('userData'), fileName)
}

function sanitizeFileName(value: string): string {
  return value.replace(/[<>:"/\\|?*]/g, '_').slice(0, 80)
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>(\s*)/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 820,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.aireport.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('git:select-repository', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Git Repository',
      properties: ['openDirectory']
    })

    if (result.canceled) return null
    return result.filePaths[0]
  })

  ipcMain.handle('git:read-branches', async (_, repositoryPath: string) =>
    readGitBranches(repositoryPath)
  )
  ipcMain.handle('git:read-commits', async (_, options: GitReadOptions) => readGitCommits(options))
  ipcMain.handle('ai:generate-report', async (_, payload: AiGeneratePayload) =>
    generateAiReport(payload)
  )
  ipcMain.handle('ai:cancel-requests', async (_, requestIdPrefix: string) =>
    cancelAiRequests(requestIdPrefix)
  )
  ipcMain.handle('ai:test-config', async (_, config: AiConfig) => testAiConfig(config))
  ipcMain.handle('config:save-ai', async (_, config: AiConfig) => saveSecureAiConfig(config))
  ipcMain.handle('config:load-ai', async () => loadSecureAiConfig())
  ipcMain.handle('workspace:save', async (_, data: unknown) => saveWorkspaceData(data))
  ipcMain.handle('workspace:load', async () => loadWorkspaceData())
  ipcMain.handle('report:export', async (_, payload: ExportPayload) => exportReport(payload))
  ipcMain.handle('shell:show-item', async (_, filePath: string) => shell.showItemInFolder(filePath))
  ipcMain.handle('app:get-locale', async () => app.getLocale())

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
