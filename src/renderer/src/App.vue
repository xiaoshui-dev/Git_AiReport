<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'

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

type ReportLevel = 'daily' | 'weekly' | 'monthly' | 'summary' | 'devlog'
type ExportFormat = 'doc' | 'html' | 'md' | 'txt' | 'pdf'
type TaskStatus = 'pending' | 'running' | 'success' | 'failed'
type CommitCategory = '功能' | '修复' | '重构' | '测试' | '构建' | '文档' | '配置' | '其他'

type Report = {
  id: string
  level: ReportLevel
  title: string
  period: string
  html: string
  markdown?: string
  commitCount: number
  fileCount: number
  sourcePeriods: string[]
  updatedAt: string
}

type ReportLevelMeta = {
  id: ReportLevel
  label: string
  action: string
}

type AiConfig = {
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
}

type GenerationTask = {
  id: string
  level: ReportLevel
  title: string
  status: TaskStatus
  error: string
}

type GenerateOptions = {
  wordCount: number
  style: string
  audience: string
  focus: string
  extraPrompt: string
  concurrency: number
  requestIntervalMs: number
  retryCount: number
  retryBackoffMs: number
}

const reportLevels: ReportLevelMeta[] = [
  { id: 'daily', label: '日报', action: '调用模型生成日报' },
  { id: 'weekly', label: '周报', action: '调用模型生成周报' },
  { id: 'monthly', label: '月报', action: '调用模型生成月报' },
  { id: 'summary', label: '总结', action: '调用模型生成总结' },
  { id: 'devlog', label: '开发日志', action: '生成开发日志' }
]

const SETTINGS_KEY = 'git-ai-report-settings'
const WORKSPACE_KEY = 'git-ai-report-workspace'
const DEVLOG_REPORT_ID = 'devlog-md'

const repositoryPath = ref('')
const commits = ref<GitCommit[]>([])
const branches = ref<string[]>([])
const reports = ref<Report[]>([])
const tasks = ref<GenerationTask[]>([])
const activeLevel = ref<ReportLevel>('daily')
const selectedReportId = ref('')
const editorEl = ref<HTMLElement | null>(null)
const isLoading = ref(false)
const isGenerating = ref(false)
const isSettingsOpen = ref(false)
const isTestingApi = ref(false)
const commitSearch = ref('')
const statusMessage = ref('选择一个 Git 仓库开始')
const errorMessage = ref('')

const aiConfig = reactive<AiConfig>({
  baseUrl: 'https://api.openai.com',
  apiKey: '',
  model: 'gpt-4.1-mini',
  temperature: 0.35,
  maxTokens: 1800
})

const generateOptions = reactive<GenerateOptions>({
  wordCount: 500,
  style: '专业简洁',
  audience: '直属主管、项目负责人',
  focus: '完成事项、影响范围、风险问题、下一步计划',
  extraPrompt: '',
  concurrency: 3,
  requestIntervalMs: 250,
  retryCount: 2,
  retryBackoffMs: 800
})


const filters = reactive({
  branch: '',
  since: '',
  until: '',
  author: '',
  keyword: '',
  category: '全部' as CommitCategory | '全部',
  fileKeyword: ''
})
const stats = reactive({
  days: 0,
  weeks: 0,
  months: 0,
  authors: 0,
  files: 0
})

loadSettings()
void loadWorkspace()

const selectedReport = computed(() => reports.value.find((report) => report.id === selectedReportId.value))
const visibleReports = computed(() => reports.value.filter((report) => report.level === activeLevel.value))
const authorOptions = computed(() => [...new Set(commits.value.map((commit) => commit.author))].filter(Boolean).sort())
const scopedCommits = computed(() => applyClientFilters(commits.value))
const commitDays = computed(() => groupCommitsByDate(scopedCommits.value))
const maxDailyCommits = computed(() => Math.max(1, ...Object.values(commitDays.value).map((items) => items.length)))
const taskStats = computed(() => ({
  total: tasks.value.length,
  success: tasks.value.filter((task) => task.status === 'success').length,
  failed: tasks.value.filter((task) => task.status === 'failed').length,
  running: tasks.value.filter((task) => task.status === 'running').length
}))
const generationProgress = computed(() => {
  if (!taskStats.value.total) return 0
  return Math.round(((taskStats.value.success + taskStats.value.failed) / taskStats.value.total) * 100)
})
const costEstimate = computed(() => {
  const chars = scopedCommits.value.reduce((total, commit) => total + commit.subject.length + commit.body.length + commit.files.join('').length, 0)
  const requests = Math.max(1, Object.keys(groupCommitsByDate(scopedCommits.value)).length)
  return { requests, tokens: Math.round(chars / 3.2 + requests * generateOptions.wordCount * 1.8) }
})

const filteredCommits = computed(() => {
  const keyword = commitSearch.value.trim().toLowerCase()
  const sorted = [...scopedCommits.value].sort((a, b) => b.date.localeCompare(a.date))
  if (!keyword) return sorted.slice(0, 120)

  return sorted
    .filter((commit) => {
      const content = [commit.date, commit.shortHash, commit.author, commit.subject, commit.body, ...commit.files]
        .join(' ')
        .toLowerCase()
      return content.includes(keyword)
    })
    .slice(0, 120)
})

const heatmapDays = computed(() => {
  const end = new Date()
  const start = new Date(end)
  start.setDate(end.getDate() - 139)
  const mondayOffset = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - mondayOffset)

  const days: Array<{ date: string; count: number; level: number }> = []
  for (let index = 0; index < 154; index += 1) {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const key = toDateKey(date)
    const count = commitDays.value[key]?.length ?? 0
    days.push({ date: key, count, level: getHeatLevel(count, maxDailyCommits.value) })
  }

  return days
})

const emptyState = computed(() => {
  if (!commits.value.length) return '暂无提交数据'
  return `${reportLevels.find((level) => level.id === activeLevel.value)?.label ?? ''}尚未生成`
})

watch(selectedReportId, () => {
  void nextTick(() => {
    if (editorEl.value) {
      editorEl.value.innerHTML = selectedReport.value?.html ?? ''
    }
  })
})

async function saveSettings(): Promise<void> {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      aiConfig: { ...aiConfig, apiKey: '' },
      generateOptions,
      filters
    })
  )
  await window.api.saveAiConfig({ ...aiConfig })
  isSettingsOpen.value = false
  statusMessage.value = 'API 配置和生成参数已保存'
}

async function loadSettings(): Promise<void> {
  const raw = localStorage.getItem(SETTINGS_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as {
        aiConfig?: Partial<AiConfig>
        generateOptions?: Partial<GenerateOptions>
        filters?: Partial<typeof filters>
      }
      Object.assign(aiConfig, parsed.aiConfig)
      Object.assign(generateOptions, parsed.generateOptions)
      Object.assign(filters, parsed.filters)
    } catch {
      localStorage.removeItem(SETTINGS_KEY)
    }
  }

  const secureConfig = await window.api.loadAiConfig()
  if (secureConfig) Object.assign(aiConfig, secureConfig)
}

function getWorkspaceSnapshot(): Record<string, unknown> {
  return JSON.parse(JSON.stringify({
    repositoryPath: repositoryPath.value,
    commits: commits.value,
    reports: reports.value,
    activeLevel: activeLevel.value,
    selectedReportId: selectedReportId.value,
    commitSearch: commitSearch.value,
    savedAt: new Date().toISOString()
  })) as Record<string, unknown>
}

function saveWorkspace(): void {
  const snapshot = getWorkspaceSnapshot()
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(snapshot))
  void window.api.saveWorkspace(snapshot)
}

async function loadWorkspace(): Promise<void> {
  let parsed = await window.api.loadWorkspace() as {
    repositoryPath?: string
    commits?: GitCommit[]
    reports?: Report[]
    activeLevel?: ReportLevel
    selectedReportId?: string
    commitSearch?: string
    savedAt?: string
  } | null

  if (!parsed) {
    const raw = localStorage.getItem(WORKSPACE_KEY)
    if (!raw) return
    try {
      parsed = JSON.parse(raw) as typeof parsed
    } catch {
      localStorage.removeItem(WORKSPACE_KEY)
      return
    }
  }

  repositoryPath.value = parsed?.repositoryPath ?? ''
  commits.value = Array.isArray(parsed?.commits) ? parsed.commits : []
  reports.value = Array.isArray(parsed?.reports) ? normalizeLoadedReports(parsed.reports) : []
  activeLevel.value = parsed?.activeLevel ?? 'daily'
  selectedReportId.value = parsed?.selectedReportId && reports.value.some((report) => report.id === parsed?.selectedReportId)
    ? parsed.selectedReportId
    : reports.value[0]?.id ?? ''
  commitSearch.value = parsed?.commitSearch ?? ''
  updateStats()
  statusMessage.value = parsed?.savedAt ? `已恢复上次记录：${new Date(parsed.savedAt).toLocaleString('zh-CN')}` : '已恢复上次记录'
}

function clearWorkspace(): void {
  repositoryPath.value = ''
  commits.value = []
  reports.value = []
  activeLevel.value = 'daily'
  selectedReportId.value = ''
  commitSearch.value = ''
  updateStats()
  localStorage.removeItem(WORKSPACE_KEY)
  statusMessage.value = '已清空保存记录'
}
function setActiveLevel(level: ReportLevel): void {
  activeLevel.value = level
  saveWorkspace()
}

async function selectRepository(): Promise<void> {
  errorMessage.value = ''
  const selectedPath = await window.api.selectRepository()
  if (selectedPath) {
    repositoryPath.value = selectedPath
    await loadBranches()
    await loadCommits()
  }
}

async function loadBranches(): Promise<void> {
  if (!repositoryPath.value.trim()) return
  try {
    const branchInfo = await window.api.readBranches(repositoryPath.value.trim())
    branches.value = branchInfo.branches
    if (!filters.branch || !branchInfo.branches.includes(filters.branch)) {
      filters.branch = branchInfo.branches.includes(branchInfo.current) ? branchInfo.current : ''
    }
  } catch (error) {
    statusMessage.value = `读取分支失败：${error instanceof Error ? error.message : String(error)}`
  }
}

async function loadCommits(): Promise<void> {
  if (!repositoryPath.value.trim()) {
    errorMessage.value = '请先选择或输入仓库路径'
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  statusMessage.value = '正在读取 Git 提交记录'

  try {
    if (!branches.value.length) await loadBranches()
    commits.value = await window.api.readCommits({
      repositoryPath: repositoryPath.value.trim(),
      branch: filters.branch,
      since: filters.since,
      until: filters.until,
      author: filters.author,
      keyword: filters.keyword
    })
    reports.value = []
    selectedReportId.value = ''
    updateStats()
    saveWorkspace()
    statusMessage.value = `已读取 ${commits.value.length} 条提交`
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '读取 Git 提交失败'
    statusMessage.value = '读取失败'
  } finally {
    isLoading.value = false
  }
}

function updateStats(): void {
  const dates = new Set(scopedCommits.value.map((commit) => commit.date))
  const weeks = new Set(scopedCommits.value.map((commit) => getWeekKey(commit.date)))
  const months = new Set(scopedCommits.value.map((commit) => commit.date.slice(0, 7)))
  const authors = new Set(scopedCommits.value.map((commit) => commit.author))
  const files = new Set(scopedCommits.value.flatMap((commit) => commit.files))

  stats.days = dates.size
  stats.weeks = weeks.size
  stats.months = months.size
  stats.authors = authors.size
  stats.files = files.size
}

async function generateReports(level: ReportLevel): Promise<void> {
  if (!commits.value.length) {
    errorMessage.value = '没有可用于生成报告的提交记录'
    return
  }

  if (!validateAiConfig()) return

  errorMessage.value = ''
  isGenerating.value = true

  try {
    if (level === 'daily') await generateDailyReports()
    if (level === 'weekly') await generateWeeklyReports()
    if (level === 'monthly') await generateMonthlyReports()
    if (level === 'summary') await generateFinalSummary()
    if (level === 'devlog') await generateDevelopmentLogs()

    activeLevel.value = level
    const firstReport = visibleReports.value[0]
    if (firstReport) selectedReportId.value = firstReport.id
    saveWorkspace()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'AI 生成失败'
    statusMessage.value = 'AI 生成失败'
  } finally {
    isGenerating.value = false
  }
}

async function generateAllReports(): Promise<void> {
  if (!commits.value.length) {
    errorMessage.value = '没有可用于生成报告的提交记录'
    return
  }

  if (!validateAiConfig()) return

  errorMessage.value = ''
  isGenerating.value = true

  try {
    await generateDailyReports()
    await generateWeeklyReports()
    await generateMonthlyReports()
    await generateFinalSummary()
    activeLevel.value = 'summary'
    selectedReportId.value = reports.value.find((report) => report.level === 'devlog')?.id ?? reports.value.find((report) => report.level === 'summary')?.id ?? ''
    saveWorkspace()
    statusMessage.value = '日报、周报、月报、总结和开发日志已通过大模型生成'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'AI 生成失败'
    statusMessage.value = 'AI 生成失败'
  } finally {
    isGenerating.value = false
  }
}

async function generateDailyReports(): Promise<void> {
  const grouped = groupCommitsByDate(scopedCommits.value)
  const entries = Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a))
  let completed = 0

  const dailyReports = await runWithConcurrency(entries, getConcurrency(), async ([date, dayCommits]) => {
    const task = createTask('daily', `${date} 日报`)
    tasks.value.push(task)
    task.status = 'running'
    statusMessage.value = `正在并发生成日报 ${completed + 1}/${entries.length}：${date}`
    try {
      await sleep(getRequestInterval())
      const summary = analyzeCommits(dayCommits)
      const html = await retryAsync(() => requestAiHtml('日报', `${date} 日报`, {
        period: date,
        commitCount: dayCommits.length,
        themes: summary.themes,
        modules: summary.modules,
        risks: summary.risks,
        category: categorizeCommit(dayCommits[0]),
        commits: compactCommits(dayCommits)
      }), getRetryCount(), getRetryBackoff())
      completed += 1
      task.status = 'success'
      statusMessage.value = `日报已完成 ${completed}/${entries.length}`
      return createReport({
        id: `daily-${date}`,
        level: 'daily',
        title: `${date} 日报`,
        period: date,
        commitCount: dayCommits.length,
        fileCount: summary.files.length,
        sourcePeriods: [date],
        html
      })
    } catch (error) {
      task.status = 'failed'
      task.error = error instanceof Error ? error.message : String(error)
      return null
    }
  })

  const successfulReports = dailyReports.filter((report): report is Report => Boolean(report))
  replaceReports('daily', successfulReports)
  statusMessage.value = `已生成 ${successfulReports.length} 份日报，失败 ${dailyReports.length - successfulReports.length} 份`
}

async function generateWeeklyReports(): Promise<void> {
  await ensureReports('daily')
  const grouped = groupReportsByKey('daily', (report) => getWeekKey(report.period))
  const entries = Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a))
  let completed = 0

  const weeklyReports = await runWithConcurrency(entries, getConcurrency(), async ([week, weekReports]) => {
    const task = createTask('weekly', `${week} 周报`)
    tasks.value.push(task)
    task.status = 'running'
    statusMessage.value = `正在并发生成周报 ${completed + 1}/${entries.length}：${week}`
    try {
      await sleep(getRequestInterval())
      const sourceDates = weekReports.flatMap((report) => report.sourcePeriods)
      const weekCommits = scopedCommits.value.filter((commit) => sourceDates.includes(commit.date))
      const summary = analyzeCommits(weekCommits)
      const html = await retryAsync(() => requestAiHtml('周报', `${week} 周报`, {
        period: week,
        sourceReports: compactReports(weekReports),
        commitCount: weekCommits.length,
        themes: summary.themes,
        modules: summary.modules,
        risks: summary.risks
      }), getRetryCount(), getRetryBackoff())
      completed += 1
      task.status = 'success'
      statusMessage.value = `周报已完成 ${completed}/${entries.length}`
      return createReport({
        id: `weekly-${week}`,
        level: 'weekly',
        title: `${week} 周报`,
        period: week,
        commitCount: weekCommits.length,
        fileCount: summary.files.length,
        sourcePeriods: sourceDates,
        html
      })
    } catch (error) {
      task.status = 'failed'
      task.error = error instanceof Error ? error.message : String(error)
      return null
    }
  })

  const successfulReports = weeklyReports.filter((report): report is Report => Boolean(report))
  replaceReports('weekly', successfulReports)
  statusMessage.value = `已生成 ${successfulReports.length} 份周报，失败 ${weeklyReports.length - successfulReports.length} 份`
}

async function generateMonthlyReports(): Promise<void> {
  await ensureReports('weekly')
  const grouped = groupReportsByKey('weekly', (report) => report.sourcePeriods[0]?.slice(0, 7) ?? report.period)
  const entries = Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a))
  let completed = 0

  const monthlyReports = await runWithConcurrency(entries, getConcurrency(), async ([month, monthReports]) => {
    const task = createTask('monthly', `${month} 月报`)
    tasks.value.push(task)
    task.status = 'running'
    statusMessage.value = `正在并发生成月报 ${completed + 1}/${entries.length}：${month}`
    try {
      await sleep(getRequestInterval())
      const sourceDates = monthReports.flatMap((report) => report.sourcePeriods)
      const monthCommits = scopedCommits.value.filter((commit) => sourceDates.includes(commit.date))
      const summary = analyzeCommits(monthCommits)
      const html = await retryAsync(() => requestAiHtml('月报', `${month} 月报`, {
        period: month,
        sourceReports: compactReports(monthReports),
        commitCount: monthCommits.length,
        themes: summary.themes,
        modules: summary.modules,
        risks: summary.risks
      }), getRetryCount(), getRetryBackoff())
      completed += 1
      task.status = 'success'
      statusMessage.value = `月报已完成 ${completed}/${entries.length}`
      return createReport({
        id: `monthly-${month}`,
        level: 'monthly',
        title: `${month} 月报`,
        period: month,
        commitCount: monthCommits.length,
        fileCount: summary.files.length,
        sourcePeriods: monthReports.map((report) => report.period),
        html
      })
    } catch (error) {
      task.status = 'failed'
      task.error = error instanceof Error ? error.message : String(error)
      return null
    }
  })

  const successfulReports = monthlyReports.filter((report): report is Report => Boolean(report))
  replaceReports('monthly', successfulReports)
  statusMessage.value = `已生成 ${successfulReports.length} 份月报，失败 ${monthlyReports.length - successfulReports.length} 份`
}

async function generateDevelopmentLogs(): Promise<void> {
  const grouped = groupCommitsByDate(scopedCommits.value)
  const entries = Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a))
  let completed = 0

  const devlogEntries = await runWithConcurrency(entries, getConcurrency(), async ([date, dayCommits]) => {
    const task = createTask('devlog', `${date} 开发日志`)
    tasks.value.push(task)
    task.status = 'running'
    statusMessage.value = `正在并发生成开发日志 ${completed + 1}/${entries.length}：${date}`
    try {
      await sleep(getRequestInterval())
      const summary = analyzeCommits(dayCommits)
      const titleHint = inferDevelopmentLogTitle(date, dayCommits, summary)
      const html = await retryAsync(() => requestAiHtml('开发日志', titleHint, {
        period: date,
        requiredStructure: ['标题：YYYY-MM-DD — 主题', '背景', '核实', '修改', '验证'],
        writingMode: '工程开发日志，写清楚为什么改、怎么核实、改了哪些文件/配置、怎么验证。语气可以具体、直接，避免空泛日报腔。',
        commitCount: dayCommits.length,
        themes: summary.themes,
        modules: summary.modules,
        risks: summary.risks,
        commits: compactCommits(dayCommits)
      }), getRetryCount(), getRetryBackoff())
      completed += 1
      task.status = 'success'
      statusMessage.value = `开发日志已完成 ${completed}/${entries.length}`
      return { date, markdown: normalizeDevlogMarkdown(date, titleHint, html), commitCount: dayCommits.length, fileCount: summary.files.length }
    } catch (error) {
      task.status = 'failed'
      task.error = error instanceof Error ? error.message : String(error)
      return null
    }
  })

  const successfulEntries = devlogEntries.filter((entry): entry is { date: string; markdown: string; commitCount: number; fileCount: number } => Boolean(entry))
  const previousReport = reports.value.find((report) => report.id === DEVLOG_REPORT_ID)
  const mergedMarkdown = mergeDevlogMarkdown(previousReport?.markdown ?? htmlToMarkdown(previousReport?.html ?? ''), successfulEntries)
  const periods = getDevlogPeriods(mergedMarkdown)
  const commitCount = successfulEntries.reduce((total, entry) => total + entry.commitCount, 0) || previousReport?.commitCount || 0
  const fileCount = successfulEntries.reduce((total, entry) => total + entry.fileCount, 0) || previousReport?.fileCount || 0

  replaceReports('devlog', [
    createReport({
      id: DEVLOG_REPORT_ID,
      level: 'devlog',
      title: 'DEVELOPMENT_LOG.md',
      period: periods.length ? `${periods[periods.length - 1]} 至 ${periods[0]}` : getDateRange(scopedCommits.value),
      commitCount,
      fileCount,
      sourcePeriods: periods,
      markdown: mergedMarkdown,
      html: markdownToHtml(mergedMarkdown)
    })
  ])
  activeLevel.value = 'devlog'
  selectedReportId.value = DEVLOG_REPORT_ID
  statusMessage.value = `已更新 DEVELOPMENT_LOG.md：新增/更新 ${successfulEntries.length} 条，失败 ${devlogEntries.length - successfulEntries.length} 条`
}
async function generateFinalSummary(): Promise<void> {
  await ensureReports('monthly')
  const monthlyReports = reports.value.filter((report) => report.level === 'monthly')
  const summary = analyzeCommits(scopedCommits.value)
  const dateRange = getDateRange(scopedCommits.value)
  statusMessage.value = '正在调用模型生成项目总结'

  const html = await requestAiHtml('项目总结', '项目工作总结', {
    period: dateRange,
    sourceReports: compactReports(monthlyReports),
    commitCount: scopedCommits.value.length,
    changedFileCount: summary.files.length,
    themes: summary.themes,
    modules: summary.modules,
    risks: summary.risks,
    authors: summary.authors
  })

  replaceReports('summary', [
    createReport({
      id: 'summary-all',
      level: 'summary',
      title: '项目工作总结',
      period: dateRange,
      commitCount: scopedCommits.value.length,
      fileCount: summary.files.length,
      sourcePeriods: monthlyReports.map((report) => report.period),
      html
    })
  ])
  statusMessage.value = '已生成项目总结'
}

async function ensureReports(level: ReportLevel): Promise<void> {
  if (reports.value.some((report) => report.level === level)) return
  if (level === 'daily') await generateDailyReports()
  if (level === 'weekly') await generateWeeklyReports()
  if (level === 'monthly') await generateMonthlyReports()
}
function getRetryCount(): number {
  const count = Number(generateOptions.retryCount)
  return Number.isFinite(count) ? Math.min(5, Math.max(0, Math.floor(count))) : 0
}

function getRetryBackoff(): number {
  const backoff = Number(generateOptions.retryBackoffMs)
  return Number.isFinite(backoff) ? Math.min(10000, Math.max(0, Math.floor(backoff))) : 800
}

function getRequestInterval(): number {
  const interval = Number(generateOptions.requestIntervalMs)
  return Number.isFinite(interval) ? Math.min(10000, Math.max(0, Math.floor(interval))) : 0
}

async function retryAsync<T>(operation: () => Promise<T>, retryCount: number, backoffMs: number): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt < retryCount) await sleep(backoffMs * (attempt + 1))
    }
  }
  throw lastError
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createTask(level: ReportLevel, title: string): GenerationTask {
  return { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, level, title, status: 'pending', error: '' }
}
function getConcurrency(): number {
  const concurrency = Number(generateOptions.concurrency)
  if (!Number.isFinite(concurrency)) return 1
  return Math.min(8, Math.max(1, Math.floor(concurrency)))
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await worker(items[currentIndex], currentIndex)
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runWorker())
  await Promise.all(workers)
  return results
}

async function requestAiHtml(reportType: string, title: string, source: unknown): Promise<string> {
  const isDevLog = reportType === '开发日志'
  const systemPrompt = [
    isDevLog
      ? '你是资深工程师，负责把 Git 提交整理成工程开发日志。日志要像真实开发复盘，写清楚背景、核实过程、具体修改和验证结果。'
      : '你是资深研发经理和技术写作助手，负责根据 Git 提交记录或上一级报告生成研发工作报告。',
    '必须返回可直接放入富文本编辑器的 HTML 片段，只允许使用 h2、h3、p、ul、ol、li、strong、em、blockquote、br 标签。',
    '不要返回 Markdown，不要返回 ``` 代码块，不要包含 html/head/body/script/style 标签。',
    '内容必须忠于输入数据，不要编造不存在的任务、成员、业务背景或指标。',
    isDevLog ? '开发日志必须使用结构：h2 标题为“YYYY-MM-DD — 主题”，然后依次包含 h3“背景”、h3“核实”、h3“修改”、h3“验证”。每节用具体段落或列表写，不要写泛泛而谈的日报套话。' : '',
    `写作风格：${generateOptions.style}。`,
    `目标读者：${generateOptions.audience}。`,
    `目标字数：约 ${generateOptions.wordCount} 字。`,
    `关注点：${generateOptions.focus}。`,
    generateOptions.extraPrompt ? `额外要求：${generateOptions.extraPrompt}` : ''
  ]
    .filter(Boolean)
    .join('\n')

  const userPrompt = truncateText(
    JSON.stringify(
      {
        reportType,
        title,
        repositoryPath: repositoryPath.value,
        source
      },
      null,
      2
    ),
    22000
  )

  const content = await window.api.generateAiReport({
    config: {
      baseUrl: aiConfig.baseUrl,
      apiKey: aiConfig.apiKey,
      model: aiConfig.model,
      temperature: Number(aiConfig.temperature),
      maxTokens: Number(aiConfig.maxTokens)
    },
    systemPrompt,
    userPrompt
  })

  return stripUnsafeHtml(normalizeModelHtml(content))
}

function validateAiConfig(): boolean {
  if (!aiConfig.baseUrl.trim()) {
    errorMessage.value = '请先填写 API Endpoint'
    return false
  }

  if (!aiConfig.model.trim()) {
    errorMessage.value = '请先填写模型名称'
    return false
  }

  saveSettings()
  return true
}

async function testApiConnection(): Promise<void> {
  isTestingApi.value = true
  try {
    const result = await window.api.testAiConfig({ ...aiConfig, maxTokens: 32 })
    statusMessage.value = `API 测试成功：${result}`
    await window.api.saveAiConfig({ ...aiConfig })
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
    statusMessage.value = 'API 测试失败'
  } finally {
    isTestingApi.value = false
  }
}

async function retryFailedTask(task: GenerationTask): Promise<void> {
  task.status = 'pending'
  task.error = ''
  if (task.level === 'daily') await generateDailyReports()
  if (task.level === 'weekly') await generateWeeklyReports()
  if (task.level === 'monthly') await generateMonthlyReports()
  if (task.level === 'summary') await generateFinalSummary()
}
function selectReport(report: Report): void {
  selectedReportId.value = report.id
  saveWorkspace()
}

function runEditorCommand(command: string, value?: string): void {
  editorEl.value?.focus()
  document.execCommand(command, false, value)
  syncEditor()
}

function syncEditor(): void {
  if (!selectedReport.value || !editorEl.value) return
  selectedReport.value.html = editorEl.value.innerHTML
  if (selectedReport.value.id === DEVLOG_REPORT_ID) {
    selectedReport.value.markdown = htmlToMarkdown(selectedReport.value.html)
  }
  selectedReport.value.updatedAt = new Date().toLocaleString('zh-CN')
  saveWorkspace()
}

async function copyReport(): Promise<void> {
  if (!selectedReport.value) return
  await navigator.clipboard.writeText(selectedReport.value.markdown ?? htmlToText(selectedReport.value.html))
  statusMessage.value = '报告正文已复制'
}

async function exportSelectedReport(format: ExportFormat = 'doc'): Promise<void> {
  if (!selectedReport.value) return
  syncEditor()
  const savedPath = await window.api.exportReport({
    title: selectedReport.value.title,
    html: selectedReport.value.html,
    markdown: selectedReport.value.markdown ?? htmlToMarkdown(selectedReport.value.html),
    text: htmlToText(selectedReport.value.html),
    format
  })
  statusMessage.value = savedPath ? `${format.toUpperCase()} 已导出：${savedPath}` : '已取消导出'
}

function replaceReports(level: ReportLevel, nextReports: Report[]): void {
  reports.value = [...reports.value.filter((report) => report.level !== level), ...nextReports]
  saveWorkspace()
}

function createReport(report: Omit<Report, 'updatedAt'>): Report {
  return {
    ...report,
    updatedAt: new Date().toLocaleString('zh-CN')
  }
}

function normalizeLoadedReports(items: Report[]): Report[] {
  const normalReports = items.filter((report) => report.level !== 'devlog')
  const devlogReports = items.filter((report) => report.level === 'devlog')
  if (!devlogReports.length) return items

  const markdown = mergeDevlogMarkdown('', devlogReports.map((report) => ({
    date: report.period.slice(0, 10),
    markdown: report.markdown ?? htmlToMarkdown(report.html),
    commitCount: report.commitCount,
    fileCount: report.fileCount
  })))
  const periods = getDevlogPeriods(markdown)
  const commitCount = devlogReports.reduce((total, report) => total + report.commitCount, 0)
  const fileCount = devlogReports.reduce((total, report) => total + report.fileCount, 0)

  return [
    ...normalReports,
    {
      id: DEVLOG_REPORT_ID,
      level: 'devlog',
      title: 'DEVELOPMENT_LOG.md',
      period: periods.length ? `${periods[periods.length - 1]} 至 ${periods[0]}` : '开发日志',
      commitCount,
      fileCount,
      sourcePeriods: periods,
      markdown,
      html: markdownToHtml(markdown),
      updatedAt: new Date().toLocaleString('zh-CN')
    }
  ]
}

function groupCommitsByDate(items: GitCommit[]): Record<string, GitCommit[]> {
  return items.reduce<Record<string, GitCommit[]>>((groups, commit) => {
    if (!groups[commit.date]) groups[commit.date] = []
    groups[commit.date].push(commit)
    return groups
  }, {})
}

function groupReportsByKey(level: ReportLevel, getKey: (report: Report) => string): Record<string, Report[]> {
  return reports.value
    .filter((report) => report.level === level)
    .reduce<Record<string, Report[]>>((groups, report) => {
      const key = getKey(report)
      if (!groups[key]) groups[key] = []
      groups[key].push(report)
      return groups
    }, {})
}

function analyzeCommits(items: GitCommit[]): {
  files: string[]
  modules: string[]
  authors: string[]
  themes: string[]
  risks: string[]
} {
  const subjects = items.map((commit) => commit.subject)
  const files = [...new Set(items.flatMap((commit) => commit.files))]
  const modules = [...new Set(files.map(getModuleName))].filter(Boolean).slice(0, 8)
  const authors = [...new Set(items.map((commit) => commit.author))]
  const themes = inferThemes(subjects, files)
  const risks = inferRisks(subjects, files)

  return { files, modules, authors, themes, risks }
}

function inferThemes(subjects: string[], files: string[]): string[] {
  const haystack = `${subjects.join(' ')} ${files.join(' ')}`.toLowerCase()
  const themeRules: Array<[string, string[]]> = [
    ['功能交付', ['feat', 'feature', 'add', '新增', '增加']],
    ['问题修复', ['fix', 'bug', '修复', '问题']],
    ['体验优化', ['ui', 'style', '优化', '交互', '页面']],
    ['工程质量', ['refactor', 'test', 'lint', '重构', '测试']],
    ['构建发布', ['build', 'ci', 'release', 'deploy', '打包']]
  ]
  const themes = themeRules
    .filter(([, keywords]) => keywords.some((keyword) => haystack.includes(keyword)))
    .map(([label]) => label)

  return themes.length ? themes : ['常规迭代']
}

function applyClientFilters(items: GitCommit[]): GitCommit[] {
  return items.filter((commit) => {
    if (filters.category !== '全部' && categorizeCommit(commit) !== filters.category) return false
    if (filters.fileKeyword.trim()) {
      const keyword = filters.fileKeyword.trim().toLowerCase()
      if (!commit.files.some((file) => file.toLowerCase().includes(keyword))) return false
    }
    return true
  })
}

function categorizeCommit(commit: GitCommit): CommitCategory {
  const text = `${commit.subject} ${commit.body} ${commit.files.join(' ')}`.toLowerCase()
  if (/doc|readme|文档/.test(text)) return '文档'
  if (/test|spec|测试/.test(text)) return '测试'
  if (/build|ci|release|deploy|打包/.test(text)) return '构建'
  if (/config|env|package|lock|配置/.test(text)) return '配置'
  if (/refactor|重构/.test(text)) return '重构'
  if (/fix|bug|修复/.test(text)) return '修复'
  if (/feat|feature|add|新增|增加/.test(text)) return '功能'
  return '其他'
}
function inferRisks(subjects: string[], files: string[]): string[] {
  const risks: string[] = []
  const uniqueFiles = new Set(files)
  const joinedSubjects = subjects.join(' ').toLowerCase()

  if (uniqueFiles.size > 20) risks.push('改动文件较多，建议回归核心流程')
  if (joinedSubjects.includes('wip') || joinedSubjects.includes('todo')) risks.push('存在未完成语义，需要确认收口计划')
  if (files.some((file) => /config|package|lock|vite|electron|tsconfig/i.test(file))) {
    risks.push('涉及配置或依赖，建议关注构建稳定性')
  }

  return risks.length ? risks : ['未发现明显风险']
}

function inferDevelopmentLogTitle(date: string, dayCommits: GitCommit[], summary: ReturnType<typeof analyzeCommits>): string {
  const primaryModule = summary.modules[0] ?? '工程整理'
  const primaryTheme = summary.themes[0] ?? '开发推进'
  const mainSubject = dayCommits[0]?.subject?.replace(/^\w+(\(.+\))?:\s*/i, '') ?? primaryTheme
  return `${date} — ${mainSubject || primaryModule}（${primaryTheme}）`
}

function normalizeDevlogMarkdown(date: string, title: string, html: string): string {
  let markdown = htmlToMarkdown(html).trim()
  markdown = markdown.replace(/^#\s+/gm, '## ').replace(/^###\s+/gm, '### ')
  if (!new RegExp(`^##\\s+${escapeRegExp(date)}\\s+—`, 'm').test(markdown)) {
    markdown = `## ${title}\n\n${markdown.replace(/^##\s+.*$/m, '').trim()}`
  }
  return markdown.replace(/\n{3,}/g, '\n\n').trim()
}

function mergeDevlogMarkdown(existingMarkdown: string, entries: Array<{ date: string; markdown: string }>): string {
  const byDate = splitDevlogEntries(existingMarkdown)
  for (const entry of entries) {
    byDate.set(entry.date, entry.markdown.trim())
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([, markdown]) => markdown.trim())
    .filter(Boolean)
    .join('\n\n')
}

function splitDevlogEntries(markdown: string): Map<string, string> {
  const entries = new Map<string, string>()
  const normalized = markdown.trim()
  if (!normalized) return entries

  const matches = [...normalized.matchAll(/^##\s+(\d{4}-\d{2}-\d{2})\s+—.*$/gm)]
  if (!matches.length) return entries

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]
    const start = match.index ?? 0
    const end = matches[index + 1]?.index ?? normalized.length
    entries.set(match[1], normalized.slice(start, end).trim())
  }
  return entries
}

function getDevlogPeriods(markdown: string): string[] {
  return [...splitDevlogEntries(markdown).keys()].sort((a, b) => b.localeCompare(a))
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/)
  const html: string[] = []
  let listOpen = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (listOpen) {
        html.push('</ul>')
        listOpen = false
      }
      continue
    }

    if (trimmed.startsWith('## ')) {
      if (listOpen) {
        html.push('</ul>')
        listOpen = false
      }
      html.push(`<h2>${formatInlineMarkdown(trimmed.slice(3))}</h2>`)
      continue
    }

    if (trimmed.startsWith('### ')) {
      if (listOpen) {
        html.push('</ul>')
        listOpen = false
      }
      html.push(`<h3>${formatInlineMarkdown(trimmed.slice(4))}</h3>`)
      continue
    }

    if (/^-\s+/.test(trimmed)) {
      if (!listOpen) {
        html.push('<ul>')
        listOpen = true
      }
      html.push(`<li>${formatInlineMarkdown(trimmed.replace(/^-\s+/, ''))}</li>`)
      continue
    }

    if (listOpen) {
      html.push('</ul>')
      listOpen = false
    }
    html.push(`<p>${formatInlineMarkdown(trimmed)}</p>`)
  }

  if (listOpen) html.push('</ul>')
  return html.join('')
}

function formatInlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function compactCommits(items: GitCommit[]): Array<Record<string, unknown>> {
  return items.map((commit) => ({
    date: commit.date,
    hash: commit.shortHash,
    author: commit.author,
    subject: commit.subject,
    body: commit.body,
    files: commit.files.slice(0, 30),
    fileCount: commit.files.length
  }))
}

function compactReports(items: Report[]): Array<Record<string, unknown>> {
  return items.map((report) => ({
    title: report.title,
    period: report.period,
    commitCount: report.commitCount,
    fileCount: report.fileCount,
    content: truncateText(htmlToText(report.html), 3500)
  }))
}

function normalizeModelHtml(content: string): string {
  const trimmed = content.trim().replace(/^```(?:html)?/i, '').replace(/```$/i, '').trim()
  if (/<(h2|h3|p|ul|ol|li|blockquote|strong|em|br)[\s>]/i.test(trimmed)) return trimmed
  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function stripUnsafeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?(?:html|head|body|meta|link|iframe|object|embed)[^>]*>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
}

function getModuleName(file: string): string {
  const parts = file.split(/[\\/]/).filter(Boolean)
  if (parts.length >= 2 && ['src', 'app', 'packages'].includes(parts[0])) return `${parts[0]}/${parts[1]}`
  return parts[0] ?? ''
}

function getDateRange(items: GitCommit[]): string {
  const dates = [...new Set(items.map((commit) => commit.date))].sort()
  if (!dates.length) return '暂无数据'
  return `${dates[0]} 至 ${dates[dates.length - 1]}`
}

function getWeekKey(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`)
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7))
  const weekOne = new Date(date.getFullYear(), 0, 4)
  const week = 1 + Math.round(((date.getTime() - weekOne.getTime()) / 86400000 - 3 + ((weekOne.getDay() + 6) % 7)) / 7)
  return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`
}

function getHeatLevel(count: number, max: number): number {
  if (count === 0) return 0
  return Math.max(1, Math.ceil((count / max) * 4))
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength)}\n...[内容过长，已截断]`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function htmlToText(html: string): string {
  const element = document.createElement('div')
  element.innerHTML = html
  return element.innerText
}

function htmlToMarkdown(html: string): string {
  return html
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>(\s*)/gi, '\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
</script>

<template>
  <main class="vscode-shell">
    <header class="titlebar">
      <div class="window-controls" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="titlebar-title">Git AI Report</div>
      <div class="titlebar-status">{{ statusMessage }}</div>
      <div class="titlebar-actions">
        <button type="button" @click="isSettingsOpen = true">配置</button>
        <button type="button" :disabled="!commits.length && !reports.length" @click="clearWorkspace">清空</button>
      </div>
    </header>

    <aside class="explorer">
      <section class="explorer-section repo-block">
        <div class="explorer-title"><span>仓库</span><small>{{ branches.length }} branches</small></div>
        <label class="field compact">路径<input v-model="repositoryPath" type="text" placeholder="D:\\Projects\\repo" /></label>
        <div class="button-row">
          <button type="button" @click="selectRepository">选择</button>
          <button type="button" class="primary" :disabled="isLoading || isGenerating" @click="loadCommits">{{ isLoading ? '读取中' : '读取' }}</button>
        </div>
      </section>

      <section class="explorer-section">
        <div class="explorer-title"><span>生成类型</span><small>{{ reports.length }} reports</small></div>
        <div class="report-tabs">
          <button v-for="level in reportLevels" :key="level.id" type="button" :class="{ active: activeLevel === level.id }" @click="setActiveLevel(level.id)">
            <span>{{ level.label }}</span><strong>{{ reports.filter((report) => report.level === level.id).length }}</strong>
          </button>
        </div>
      </section>

      <section class="explorer-section filters-block">
        <div class="explorer-title"><span>筛选器</span><small>{{ scopedCommits.length }} commits</small></div>
        <label class="field compact">分支<select v-model="filters.branch" @change="loadCommits"><option value="">当前分支</option><option v-for="branch in branches" :key="branch" :value="branch">{{ branch }}</option></select></label>
        <div class="field-pair">
          <label class="field compact">开始<input v-model="filters.since" type="date" /></label>
          <label class="field compact">结束<input v-model="filters.until" type="date" /></label>
        </div>
        <label class="field compact">作者<select v-model="filters.author"><option value="">全部作者</option><option v-for="author in authorOptions" :key="author" :value="author">{{ author }}</option></select></label>
        <label class="field compact">关键字<input v-model="filters.keyword" type="text" placeholder="feat / 修复 / 需求" /></label>
        <div class="field-pair">
          <label class="field compact">分类<select v-model="filters.category"><option>全部</option><option>功能</option><option>修复</option><option>重构</option><option>测试</option><option>构建</option><option>文档</option><option>配置</option><option>其他</option></select></label>
          <label class="field compact">文件<input v-model="filters.fileKeyword" type="text" placeholder="src/api" /></label>
        </div>
        <button type="button" class="full" @click="loadCommits">应用筛选</button>
      </section>


      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    </aside>

    <section class="editor-workspace">
      <section class="commandbar" aria-label="生成工具栏">
        <div class="commandbar-group">
          <span class="commandbar-label">生成</span>
          <button v-for="level in reportLevels" :key="level.action" type="button" :disabled="!scopedCommits.length || isGenerating" @click="generateReports(level.id)">{{ level.label }}</button>
        </div>
        <div class="commandbar-spacer"></div>
        <button type="button" class="primary" :disabled="!scopedCommits.length || isGenerating" @click="generateAllReports">{{ isGenerating ? '生成中' : '一键生成全部' }}</button>
      </section>

      <section class="metrics-bar">
        <div class="metric"><strong>{{ scopedCommits.length }}</strong><span>提交</span></div>
        <div class="metric"><strong>{{ stats.days }}</strong><span>天</span></div>
        <div class="metric"><strong>{{ stats.weeks }}</strong><span>周</span></div>
        <div class="metric"><strong>{{ stats.months }}</strong><span>月</span></div>
        <div class="metric"><strong>{{ stats.files }}</strong><span>文件</span></div>
        <div class="metric"><strong>{{ costEstimate.tokens }}</strong><span>Token</span></div>
        <div class="repo-path">{{ repositoryPath || '未选择仓库' }}</div>
      </section>

      <section class="workbench">
        <aside class="report-sidebar">
          <div class="panel-heading"><h2>{{ reportLevels.find((level) => level.id === activeLevel)?.label }}</h2><span>{{ visibleReports.length }}</span></div>
          <div class="report-list">
            <button v-for="report in visibleReports" :key="report.id" type="button" class="report-entry" :class="{ active: selectedReportId === report.id }" @click="selectReport(report)">
              <strong>{{ report.title }}</strong>
              <span>{{ report.commitCount }} commits · {{ report.fileCount }} files</span>
            </button>
            <div v-if="!visibleReports.length" class="empty-state">{{ emptyState }}</div>
          </div>
        </aside>

        <section class="document-pane">
          <header class="tabbar">
            <div class="tab active">{{ selectedReport?.title || 'welcome.md' }}</div>
            <div class="editor-actions">
              <button type="button" :disabled="!selectedReport" @click="copyReport">复制</button>
              <button type="button" :disabled="!selectedReport" @click="exportSelectedReport('doc')">Word</button>
              <button type="button" :disabled="!selectedReport" @click="exportSelectedReport('html')">HTML</button>
              <button type="button" :disabled="!selectedReport" @click="exportSelectedReport('md')">MD</button>
              <button type="button" :disabled="!selectedReport" @click="exportSelectedReport('pdf')">PDF</button>
            </div>
          </header>
          <div class="toolbar" role="toolbar" aria-label="富文本工具栏">
            <button type="button" :disabled="!selectedReport" @click="runEditorCommand('bold')"><span>B</span>加粗</button>
            <button type="button" :disabled="!selectedReport" @click="runEditorCommand('italic')"><span>I</span>斜体</button>
            <button type="button" :disabled="!selectedReport" @click="runEditorCommand('underline')"><span>U</span>下划线</button>
            <button type="button" :disabled="!selectedReport" @click="runEditorCommand('formatBlock', 'h3')"><span>H</span>标题</button>
            <button type="button" :disabled="!selectedReport" @click="runEditorCommand('insertUnorderedList')"><span>•</span>列表</button>
            <button type="button" :disabled="!selectedReport" @click="runEditorCommand('insertOrderedList')"><span>1.</span>编号</button>
            <button type="button" :disabled="!selectedReport" @click="runEditorCommand('formatBlock', 'blockquote')"><span>“</span>引用</button>
          </div>
          <article ref="editorEl" class="rich-editor" :class="{ disabled: !selectedReport }" contenteditable="true" spellcheck="false" @input="syncEditor" />
        </section>

        <aside class="commit-pane">
          <div class="panel-heading"><h2>提交记录</h2><span>{{ filteredCommits.length }}</span></div>
          <input v-model="commitSearch" class="commit-search" type="text" placeholder="搜索提交、作者、文件" />
          <div class="heatmap" aria-label="提交热力图"><span v-for="day in heatmapDays" :key="day.date" class="heat-cell" :class="`level-${day.level}`" :title="`${day.date}: ${day.count} 次提交`" /></div>
          <div class="commit-list">
            <article v-for="commit in filteredCommits" :key="commit.hash" class="commit-item">
              <div class="commit-line"><strong>{{ commit.subject }}</strong><code>{{ commit.shortHash }}</code></div>
              <div class="commit-meta">{{ commit.date }} · {{ commit.author }} · {{ categorizeCommit(commit) }} · {{ commit.files.length }} 文件</div>
              <div v-if="commit.files.length" class="file-row"><span v-for="file in commit.files.slice(0, 4)" :key="file">{{ file }}</span><span v-if="commit.files.length > 4">+{{ commit.files.length - 4 }}</span></div>
            </article>
            <div v-if="!filteredCommits.length" class="empty-state small">暂无提交记录</div>
          </div>
        </aside>
      </section>

      <footer class="panelbar" :class="{ open: tasks.length }">
        <div class="panelbar-header">
          <strong>生成任务</strong>
          <span>{{ generationProgress }}% · 成功 {{ taskStats.success }} · 失败 {{ taskStats.failed }} · 预计请求 {{ costEstimate.requests }}</span>
        </div>
        <div class="progress-track"><span :style="{ width: `${generationProgress}%` }" /></div>
        <div v-if="tasks.length" class="task-list">
          <article v-for="task in tasks" :key="task.id" class="task-item" :class="task.status">
            <strong>{{ task.title }}</strong><span>{{ task.status }} {{ task.error ? `· ${task.error}` : '' }}</span><button v-if="task.status === 'failed'" type="button" @click="retryFailedTask(task)">重试</button>
          </article>
        </div>
      </footer>
    </section>

    <div v-if="isSettingsOpen" class="modal-backdrop" @click.self="isSettingsOpen = false">
      <section class="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
        <div class="modal-header"><div><h2 id="settingsTitle">配置生成参数</h2><p>API 配置和报告生成偏好会保存在本机</p></div><button type="button" @click="isSettingsOpen = false">关闭</button></div>
        <div class="settings-grid">
          <section class="modal-section">
            <div class="modal-section-title">API 配置</div>
            <label class="field">Base URL / Endpoint<input v-model="aiConfig.baseUrl" type="text" placeholder="https://api.openai.com 或完整 /chat/completions" /></label>
            <label class="field">API Key<input v-model="aiConfig.apiKey" type="password" placeholder="sk-..." /></label>
            <div class="field-pair"><label class="field">模型<input v-model="aiConfig.model" type="text" /></label><label class="field">Max Tokens<input v-model.number="aiConfig.maxTokens" type="number" min="256" max="8000" step="128" /></label></div>
            <label class="field">温度 {{ Number(aiConfig.temperature).toFixed(2) }}<input v-model.number="aiConfig.temperature" class="range-input" type="range" min="0" max="1" step="0.05" /></label>
            <button type="button" :disabled="isTestingApi" @click="testApiConnection">{{ isTestingApi ? '测试中' : '测试连接' }}</button>
          </section>
          <section class="modal-section">
            <div class="modal-section-title">生成自定义</div>
            <div class="field-pair"><label class="field">字数<input v-model.number="generateOptions.wordCount" type="number" min="100" max="3000" step="50" /></label><label class="field">风格<select v-model="generateOptions.style"><option>专业简洁</option><option>详细正式</option><option>结果导向</option><option>复盘分析</option><option>轻量口语</option></select></label></div>
            <div class="field-triplet"><label class="field">并发<input v-model.number="generateOptions.concurrency" type="number" min="1" max="8" /></label><label class="field">间隔ms<input v-model.number="generateOptions.requestIntervalMs" type="number" min="0" max="10000" step="100" /></label><label class="field">重试<input v-model.number="generateOptions.retryCount" type="number" min="0" max="5" /></label></div>
            <label class="field">退避ms<input v-model.number="generateOptions.retryBackoffMs" type="number" min="0" max="10000" step="100" /></label>
            <label class="field">读者<input v-model="generateOptions.audience" type="text" /></label>
            <label class="field">关注点<textarea v-model="generateOptions.focus" rows="2" /></label>
            <label class="field">额外提示词<textarea v-model="generateOptions.extraPrompt" rows="3" placeholder="例如：突出风险闭环，避免过度承诺" /></label>
          </section>
        </div>
        <div class="modal-footer"><button type="button" @click="isSettingsOpen = false">取消</button><button type="button" class="primary" @click="saveSettings">保存配置</button></div>
      </section>
    </div>
  </main>
</template>



