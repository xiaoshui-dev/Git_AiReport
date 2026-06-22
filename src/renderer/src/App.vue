<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'

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
type TaskStatus = 'pending' | 'blocked' | 'running' | 'success' | 'failed' | 'canceled'
type CommitCategory =
  | 'feature'
  | 'fix'
  | 'refactor'
  | 'test'
  | 'build'
  | 'docs'
  | 'config'
  | 'other'
type CategoryFilter = CommitCategory | 'all'
type AppLanguage = 'zh-CN' | 'en-US' | 'ja-JP' | 'ko-KR'
type AppTheme = 'light' | 'dark'

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
  runId: string
  level: ReportLevel
  title: string
  status: TaskStatus
  error: string
  queuedAt: number
  startedAt?: number
  finishedAt?: number
  attempts: number
}

type GenerateOptions = {
  wordCounts: Record<ReportLevel, number>
  style: string
  audience: string
  focus: string
  extraPrompt: string
  concurrency: number
  requestIntervalMs: number
  retryCount: number
  retryBackoffMs: number
}

type GenerationPlan = {
  daily: GenerationTask[]
  weekly: GenerationTask[]
  monthly: GenerationTask[]
  summary: GenerationTask[]
  devlog: GenerationTask[]
}

type UiSettings = {
  language: AppLanguage
  theme: AppTheme
}

type MessageKey = keyof (typeof messages)['zh-CN']

const languageOptions: Array<{ id: AppLanguage; label: string }> = [
  { id: 'zh-CN', label: '简体中文' },
  { id: 'en-US', label: 'English' },
  { id: 'ja-JP', label: '日本語' },
  { id: 'ko-KR', label: '한국어' }
]

const reportLevelIds: ReportLevel[] = ['daily', 'weekly', 'monthly', 'summary', 'devlog']
const commitCategoryIds: CommitCategory[] = [
  'feature',
  'fix',
  'refactor',
  'test',
  'build',
  'docs',
  'config',
  'other'
]

const messages = {
  'zh-CN': {
    appTitle: 'Git AI Report',
    settings: '配置',
    clear: '清空',
    repository: '仓库',
    path: '路径',
    select: '选择',
    read: '读取',
    reading: '读取中',
    reportTypes: '生成类型',
    filters: '筛选器',
    branch: '分支',
    currentBranch: '当前分支',
    start: '开始',
    end: '结束',
    author: '作者',
    allAuthors: '全部作者',
    keyword: '关键字',
    category: '分类',
    file: '文件',
    applyFilters: '应用筛选',
    generate: '生成',
    generateAll: '一键生成全部',
    generating: '生成中',
    commits: '提交',
    days: '天',
    weeks: '周',
    months: '月',
    files: '文件',
    noRepository: '未选择仓库',
    reportTasks: '生成任务',
    success: '成功',
    failed: '失败',
    estimatedRequests: '预计请求',
    retry: '重试',
    copy: '复制',
    bold: '加粗',
    italic: '斜体',
    underline: '下划线',
    heading: '标题',
    list: '列表',
    orderedList: '编号',
    quote: '引用',
    commitRecords: '提交记录',
    searchCommits: '搜索提交、作者、文件',
    noCommits: '暂无提交记录',
    chooseOrGenerateReport: '请选择或生成一份报告',
    settingsTitle: '配置生成参数',
    settingsDescription: 'API 配置和报告生成偏好会保存在本机',
    close: '关闭',
    apiConfig: 'API 配置',
    generationSettings: '生成自定义',
    language: '语言',
    languageHint: '默认跟随系统语言，可在这里手动切换',
    model: '模型',
    temperature: '温度',
    testConnection: '测试连接',
    testing: '测试中',
    wordCount: '字数',
    style: '风格',
    concurrency: '并发',
    intervalMs: '间隔ms',
    retryCount: '重试',
    backoffMs: '退避ms',
    audience: '读者',
    focus: '关注点',
    extraPrompt: '额外提示词',
    cancel: '取消',
    saveSettings: '保存配置',
    concurrencyHint: '并发越高速度越快，但可能触发模型服务限流',
    emptyCommits: '暂无提交数据',
    emptyReportSuffix: '尚未生成',
    statusChooseRepo: '选择一个 Git 仓库开始',
    settingsSaved: 'API 配置、语言和生成参数已保存',
    workspaceRestored: '已恢复上次记录',
    workspaceCleared: '已清空保存记录',
    readingCommits: '正在读取 Git 提交记录',
    readFailed: '读取失败',
    readCommitsFailed: '读取 Git 提交失败',
    chooseRepoFirst: '请先选择或输入仓库路径',
    noCommitsForReport: '没有可用于生成报告的提交记录',
    aiGenerateFailed: 'AI 生成失败',
    fillEndpoint: '请先填写 API Endpoint',
    fillModel: '请先填写模型名称',
    apiTestFailed: 'API 测试失败',
    copied: '报告正文已复制',
    exportCanceled: '已取消导出',
    daily: '日报',
    weekly: '周报',
    monthly: '月报',
    summary: '总结',
    devlog: '开发日志',
    projectSummary: '项目工作总结',
    allDone: '日报、周报、月报、总结和开发日志已通过大模型生成',
    professional: '专业简洁',
    formal: '详细正式',
    resultFocused: '结果导向',
    review: '复盘分析',
    casual: '轻量口语',
    defaultAudience: '直属主管、项目负责人',
    defaultFocus: '完成事项、影响范围、风险问题、下一步计划',
    promptPlaceholder: '例如：突出风险闭环，避免过度承诺',
    all: '全部',
    feature: '功能',
    fix: '修复',
    refactor: '重构',
    test: '测试',
    build: '构建',
    docs: '文档',
    config: '配置',
    other: '其他',
    pending: '等待',
    blocked: '等待依赖',
    running: '进行中',
    canceled: '已中断',
    cancelGeneration: '中断生成',
    elapsed: '已耗时',
    totalElapsed: '总耗时',
    avgElapsed: '平均',
    queueElapsed: '排队',
    attempts: '尝试',
    fontSize: '字号',
    paragraph: '正文',
    heading2: '二级标题',
    heading3: '三级标题',
    undo: '撤销',
    redo: '重做',
    alignLeft: '左对齐',
    alignCenter: '居中',
    alignRight: '右对齐',
    indent: '缩进',
    outdent: '减少缩进',
    removeFormat: '清除格式',
    link: '链接',
    theme: '主题',
    lightTheme: '浅色',
    darkTheme: '深色',
    typeWordCounts: '各类型字数',
    outputLanguage: '简体中文'
  },
  'en-US': {
    appTitle: 'Git AI Report',
    settings: 'Settings',
    clear: 'Clear',
    repository: 'Repository',
    path: 'Path',
    select: 'Select',
    read: 'Read',
    reading: 'Reading',
    reportTypes: 'Report Types',
    filters: 'Filters',
    branch: 'Branch',
    currentBranch: 'Current branch',
    start: 'Start',
    end: 'End',
    author: 'Author',
    allAuthors: 'All authors',
    keyword: 'Keyword',
    category: 'Category',
    file: 'File',
    applyFilters: 'Apply Filters',
    generate: 'Generate',
    generateAll: 'Generate All',
    generating: 'Generating',
    commits: 'Commits',
    days: 'Days',
    weeks: 'Weeks',
    months: 'Months',
    files: 'Files',
    noRepository: 'No repository selected',
    reportTasks: 'Generation Tasks',
    success: 'Success',
    failed: 'Failed',
    estimatedRequests: 'Estimated requests',
    retry: 'Retry',
    copy: 'Copy',
    bold: 'Bold',
    italic: 'Italic',
    underline: 'Underline',
    heading: 'Heading',
    list: 'List',
    orderedList: 'Numbered',
    quote: 'Quote',
    commitRecords: 'Commit Records',
    searchCommits: 'Search commits, authors, files',
    noCommits: 'No commit records',
    chooseOrGenerateReport: 'Select or generate a report',
    settingsTitle: 'Generation Settings',
    settingsDescription: 'API settings and report preferences are saved locally',
    close: 'Close',
    apiConfig: 'API Config',
    generationSettings: 'Generation Settings',
    language: 'Language',
    languageHint: 'Defaults to system language and can be changed here',
    model: 'Model',
    temperature: 'Temperature',
    testConnection: 'Test Connection',
    testing: 'Testing',
    wordCount: 'Words',
    style: 'Style',
    concurrency: 'Concurrency',
    intervalMs: 'Interval ms',
    retryCount: 'Retries',
    backoffMs: 'Backoff ms',
    audience: 'Audience',
    focus: 'Focus',
    extraPrompt: 'Extra Prompt',
    cancel: 'Cancel',
    saveSettings: 'Save Settings',
    concurrencyHint: 'Higher concurrency is faster but may trigger provider rate limits',
    emptyCommits: 'No commit data',
    emptyReportSuffix: 'not generated yet',
    statusChooseRepo: 'Select a Git repository to start',
    settingsSaved: 'API settings, language, and generation options saved',
    workspaceRestored: 'Previous workspace restored',
    workspaceCleared: 'Workspace cleared',
    readingCommits: 'Reading Git commits',
    readFailed: 'Read failed',
    readCommitsFailed: 'Failed to read Git commits',
    chooseRepoFirst: 'Select or enter a repository path first',
    noCommitsForReport: 'No commits available for report generation',
    aiGenerateFailed: 'AI generation failed',
    fillEndpoint: 'Please fill in API Endpoint first',
    fillModel: 'Please fill in model name first',
    apiTestFailed: 'API test failed',
    copied: 'Report content copied',
    exportCanceled: 'Export canceled',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    summary: 'Summary',
    devlog: 'Dev Log',
    projectSummary: 'Project Work Summary',
    allDone: 'Daily, weekly, monthly, summary, and dev logs generated by the model',
    professional: 'Professional',
    formal: 'Detailed formal',
    resultFocused: 'Result focused',
    review: 'Review analysis',
    casual: 'Light conversational',
    defaultAudience: 'Direct manager, project owner',
    defaultFocus: 'Completed work, impact, risks, next steps',
    promptPlaceholder: 'Example: emphasize risk closure and avoid overpromising',
    all: 'All',
    feature: 'Feature',
    fix: 'Fix',
    refactor: 'Refactor',
    test: 'Test',
    build: 'Build',
    docs: 'Docs',
    config: 'Config',
    other: 'Other',
    pending: 'Pending',
    blocked: 'Waiting dependency',
    running: 'Running',
    canceled: 'Canceled',
    cancelGeneration: 'Cancel generation',
    elapsed: 'Elapsed',
    totalElapsed: 'Total',
    avgElapsed: 'Avg',
    queueElapsed: 'Queue',
    attempts: 'Attempts',
    fontSize: 'Font size',
    paragraph: 'Paragraph',
    heading2: 'Heading 2',
    heading3: 'Heading 3',
    undo: 'Undo',
    redo: 'Redo',
    alignLeft: 'Align left',
    alignCenter: 'Center',
    alignRight: 'Align right',
    indent: 'Indent',
    outdent: 'Outdent',
    removeFormat: 'Clear format',
    link: 'Link',
    theme: 'Theme',
    lightTheme: 'Light',
    darkTheme: 'Dark',
    typeWordCounts: 'Words by type',
    outputLanguage: 'English'
  },
  'ja-JP': {
    appTitle: 'Git AI Report',
    settings: '設定',
    clear: 'クリア',
    repository: 'リポジトリ',
    path: 'パス',
    select: '選択',
    read: '読み込み',
    reading: '読み込み中',
    reportTypes: '生成タイプ',
    filters: 'フィルター',
    branch: 'ブランチ',
    currentBranch: '現在のブランチ',
    start: '開始',
    end: '終了',
    author: '作成者',
    allAuthors: 'すべての作成者',
    keyword: 'キーワード',
    category: 'カテゴリ',
    file: 'ファイル',
    applyFilters: 'フィルター適用',
    generate: '生成',
    generateAll: 'すべて生成',
    generating: '生成中',
    commits: 'コミット',
    days: '日',
    weeks: '週',
    months: '月',
    files: 'ファイル',
    noRepository: 'リポジトリ未選択',
    reportTasks: '生成タスク',
    success: '成功',
    failed: '失敗',
    estimatedRequests: '推定リクエスト',
    retry: '再試行',
    copy: 'コピー',
    bold: '太字',
    italic: '斜体',
    underline: '下線',
    heading: '見出し',
    list: 'リスト',
    orderedList: '番号',
    quote: '引用',
    commitRecords: 'コミット記録',
    searchCommits: 'コミット、作成者、ファイルを検索',
    noCommits: 'コミット記録なし',
    chooseOrGenerateReport: 'レポートを選択または生成してください',
    settingsTitle: '生成設定',
    settingsDescription: 'API 設定と生成設定はローカルに保存されます',
    close: '閉じる',
    apiConfig: 'API 設定',
    generationSettings: '生成設定',
    language: '言語',
    languageHint: '既定はシステム言語です。ここで変更できます',
    model: 'モデル',
    temperature: '温度',
    testConnection: '接続テスト',
    testing: 'テスト中',
    wordCount: '文字数',
    style: 'スタイル',
    concurrency: '並行数',
    intervalMs: '間隔ms',
    retryCount: '再試行',
    backoffMs: 'バックオフms',
    audience: '読者',
    focus: '重点',
    extraPrompt: '追加プロンプト',
    cancel: 'キャンセル',
    saveSettings: '設定を保存',
    concurrencyHint: '並行数を上げると高速になりますが、制限にかかる可能性があります',
    emptyCommits: 'コミットデータなし',
    emptyReportSuffix: '未生成',
    statusChooseRepo: 'Git リポジトリを選択して開始',
    settingsSaved: 'API 設定、言語、生成設定を保存しました',
    workspaceRestored: '前回のワークスペースを復元しました',
    workspaceCleared: 'ワークスペースをクリアしました',
    readingCommits: 'Git コミットを読み込み中',
    readFailed: '読み込み失敗',
    readCommitsFailed: 'Git コミットの読み込みに失敗しました',
    chooseRepoFirst: '先にリポジトリパスを選択または入力してください',
    noCommitsForReport: 'レポート生成に使えるコミットがありません',
    aiGenerateFailed: 'AI 生成に失敗しました',
    fillEndpoint: 'API Endpoint を先に入力してください',
    fillModel: 'モデル名を先に入力してください',
    apiTestFailed: 'API テストに失敗しました',
    copied: 'レポート本文をコピーしました',
    exportCanceled: 'エクスポートをキャンセルしました',
    daily: '日報',
    weekly: '週報',
    monthly: '月報',
    summary: 'まとめ',
    devlog: '開発ログ',
    projectSummary: 'プロジェクト作業まとめ',
    allDone: '日報、週報、月報、まとめ、開発ログを生成しました',
    professional: '簡潔で専門的',
    formal: '詳細で正式',
    resultFocused: '成果重視',
    review: '振り返り分析',
    casual: '軽い口調',
    defaultAudience: '直属上司、プロジェクト責任者',
    defaultFocus: '完了事項、影響範囲、リスク、次の計画',
    promptPlaceholder: '例：リスク対応を強調し、過度な約束を避ける',
    all: 'すべて',
    feature: '機能',
    fix: '修正',
    refactor: 'リファクタ',
    test: 'テスト',
    build: 'ビルド',
    docs: '文書',
    config: '設定',
    other: 'その他',
    pending: '待機',
    blocked: '依存待ち',
    running: '実行中',
    canceled: '中断済み',
    cancelGeneration: '生成を中断',
    elapsed: '経過',
    totalElapsed: '合計',
    avgElapsed: '平均',
    queueElapsed: '待機',
    attempts: '試行',
    fontSize: '文字サイズ',
    paragraph: '本文',
    heading2: '見出し2',
    heading3: '見出し3',
    undo: '元に戻す',
    redo: 'やり直す',
    alignLeft: '左揃え',
    alignCenter: '中央揃え',
    alignRight: '右揃え',
    indent: 'インデント',
    outdent: 'インデント解除',
    removeFormat: '書式クリア',
    link: 'リンク',
    theme: 'テーマ',
    lightTheme: 'ライト',
    darkTheme: 'ダーク',
    typeWordCounts: 'タイプ別文字数',
    outputLanguage: '日本語'
  },
  'ko-KR': {
    appTitle: 'Git AI Report',
    settings: '설정',
    clear: '초기화',
    repository: '저장소',
    path: '경로',
    select: '선택',
    read: '읽기',
    reading: '읽는 중',
    reportTypes: '생성 유형',
    filters: '필터',
    branch: '브랜치',
    currentBranch: '현재 브랜치',
    start: '시작',
    end: '종료',
    author: '작성자',
    allAuthors: '전체 작성자',
    keyword: '키워드',
    category: '분류',
    file: '파일',
    applyFilters: '필터 적용',
    generate: '생성',
    generateAll: '전체 생성',
    generating: '생성 중',
    commits: '커밋',
    days: '일',
    weeks: '주',
    months: '월',
    files: '파일',
    noRepository: '저장소 미선택',
    reportTasks: '생성 작업',
    success: '성공',
    failed: '실패',
    estimatedRequests: '예상 요청',
    retry: '재시도',
    copy: '복사',
    bold: '굵게',
    italic: '기울임',
    underline: '밑줄',
    heading: '제목',
    list: '목록',
    orderedList: '번호',
    quote: '인용',
    commitRecords: '커밋 기록',
    searchCommits: '커밋, 작성자, 파일 검색',
    noCommits: '커밋 기록 없음',
    chooseOrGenerateReport: '보고서를 선택하거나 생성하세요',
    settingsTitle: '생성 설정',
    settingsDescription: 'API 설정과 생성 옵션은 로컬에 저장됩니다',
    close: '닫기',
    apiConfig: 'API 설정',
    generationSettings: '생성 설정',
    language: '언어',
    languageHint: '기본값은 시스템 언어이며 여기에서 변경할 수 있습니다',
    model: '모델',
    temperature: '온도',
    testConnection: '연결 테스트',
    testing: '테스트 중',
    wordCount: '단어 수',
    style: '스타일',
    concurrency: '동시 실행',
    intervalMs: '간격ms',
    retryCount: '재시도',
    backoffMs: '대기ms',
    audience: '대상',
    focus: '중점',
    extraPrompt: '추가 프롬프트',
    cancel: '취소',
    saveSettings: '설정 저장',
    concurrencyHint: '동시 실행을 높이면 빨라지지만 제한에 걸릴 수 있습니다',
    emptyCommits: '커밋 데이터 없음',
    emptyReportSuffix: '아직 생성되지 않음',
    statusChooseRepo: 'Git 저장소를 선택하여 시작',
    settingsSaved: 'API 설정, 언어, 생성 옵션이 저장되었습니다',
    workspaceRestored: '이전 작업 공간을 복원했습니다',
    workspaceCleared: '작업 공간을 초기화했습니다',
    readingCommits: 'Git 커밋을 읽는 중',
    readFailed: '읽기 실패',
    readCommitsFailed: 'Git 커밋 읽기 실패',
    chooseRepoFirst: '먼저 저장소 경로를 선택하거나 입력하세요',
    noCommitsForReport: '보고서 생성에 사용할 커밋이 없습니다',
    aiGenerateFailed: 'AI 생성 실패',
    fillEndpoint: 'API Endpoint를 먼저 입력하세요',
    fillModel: '모델명을 먼저 입력하세요',
    apiTestFailed: 'API 테스트 실패',
    copied: '보고서 본문을 복사했습니다',
    exportCanceled: '내보내기가 취소되었습니다',
    daily: '일일 보고서',
    weekly: '주간 보고서',
    monthly: '월간 보고서',
    summary: '요약',
    devlog: '개발 로그',
    projectSummary: '프로젝트 작업 요약',
    allDone: '일일, 주간, 월간, 요약, 개발 로그를 생성했습니다',
    professional: '전문적이고 간결',
    formal: '상세하고 공식적',
    resultFocused: '결과 중심',
    review: '회고 분석',
    casual: '가벼운 문체',
    defaultAudience: '직속 관리자, 프로젝트 책임자',
    defaultFocus: '완료 작업, 영향 범위, 위험, 다음 계획',
    promptPlaceholder: '예: 위험 대응을 강조하고 과도한 약속은 피하기',
    all: '전체',
    feature: '기능',
    fix: '수정',
    refactor: '리팩터링',
    test: '테스트',
    build: '빌드',
    docs: '문서',
    config: '설정',
    other: '기타',
    pending: '대기',
    blocked: '의존 대기',
    running: '진행 중',
    canceled: '중단됨',
    cancelGeneration: '생성 중단',
    elapsed: '경과',
    totalElapsed: '전체',
    avgElapsed: '평균',
    queueElapsed: '대기',
    attempts: '시도',
    fontSize: '글자 크기',
    paragraph: '본문',
    heading2: '제목 2',
    heading3: '제목 3',
    undo: '실행 취소',
    redo: '다시 실행',
    alignLeft: '왼쪽 정렬',
    alignCenter: '가운데 정렬',
    alignRight: '오른쪽 정렬',
    indent: '들여쓰기',
    outdent: '내어쓰기',
    removeFormat: '서식 지우기',
    link: '링크',
    theme: '테마',
    lightTheme: '라이트',
    darkTheme: '다크',
    typeWordCounts: '유형별 단어 수',
    outputLanguage: '한국어'
  }
} as const

const SETTINGS_KEY = 'git-ai-report-settings'
const WORKSPACE_KEY = 'git-ai-report-workspace'
const DEVLOG_REPORT_ID = 'devlog-md'
const MAX_CONCURRENCY = 24

const repositoryPath = ref('')
const commits = ref<GitCommit[]>([])
const branches = ref<string[]>([])
const reports = ref<Report[]>([])
const tasks = ref<GenerationTask[]>([])
const currentRunId = ref('')
const canceledRunIds = new Set<string>()
const activeLevel = ref<ReportLevel>('daily')
const selectedReportId = ref('')
const editorEl = ref<HTMLElement | null>(null)
const isLoading = ref(false)
const isGenerating = ref(false)
const isSettingsOpen = ref(false)
const isTestingApi = ref(false)
const commitSearch = ref('')
const statusMessage = ref('')
const errorMessage = ref('')

const uiSettings = reactive<UiSettings>({
  language: detectBrowserLanguage(),
  theme: detectBrowserTheme()
})

const aiConfig = reactive<AiConfig>({
  baseUrl: 'https://api.openai.com',
  apiKey: '',
  model: 'gpt-4.1-mini',
  temperature: 0.35,
  maxTokens: 1800
})

const generateOptions = reactive<GenerateOptions>({
  wordCounts: {
    daily: 450,
    weekly: 700,
    monthly: 900,
    summary: 1000,
    devlog: 650
  },
  style: messages[uiSettings.language].professional,
  audience: messages[uiSettings.language].defaultAudience,
  focus: messages[uiSettings.language].defaultFocus,
  extraPrompt: '',
  concurrency: 6,
  requestIntervalMs: 0,
  retryCount: 2,
  retryBackoffMs: 800
})

const filters = reactive({
  branch: '',
  since: '',
  until: '',
  author: '',
  keyword: '',
  category: 'all' as CategoryFilter,
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
statusMessage.value = t('statusChooseRepo')
void initSystemLanguage()
void loadWorkspace()
applyTheme()

const reportLevels = computed<ReportLevelMeta[]>(() =>
  reportLevelIds.map((id) => ({
    id,
    label: t(id),
    action: `${t('generate')} ${t(id)}`
  }))
)
const selectedReport = computed(() =>
  reports.value.find((report) => report.id === selectedReportId.value)
)
const visibleReports = computed(() =>
  reports.value.filter((report) => report.level === activeLevel.value)
)
const authorOptions = computed(() =>
  [...new Set(commits.value.map((commit) => commit.author))].filter(Boolean).sort()
)
const scopedCommits = computed(() => applyClientFilters(commits.value))
const commitDays = computed(() => groupCommitsByDate(scopedCommits.value))
const maxDailyCommits = computed(() =>
  Math.max(1, ...Object.values(commitDays.value).map((items) => items.length))
)
const liveNow = ref(Date.now())
const taskStats = computed(() => ({
  total: tasks.value.length,
  success: tasks.value.filter((task) => task.status === 'success').length,
  failed: tasks.value.filter((task) => task.status === 'failed').length,
  running: tasks.value.filter((task) => task.status === 'running').length,
  pending: tasks.value.filter((task) => task.status === 'pending').length,
  blocked: tasks.value.filter((task) => task.status === 'blocked').length,
  canceled: tasks.value.filter((task) => task.status === 'canceled').length
}))
const generationProgress = computed(() => {
  if (!taskStats.value.total) return 0
  const finished = taskStats.value.success + taskStats.value.failed + taskStats.value.canceled
  return Math.round((finished / taskStats.value.total) * 100)
})
const taskTimingStats = computed(() => {
  const startedTasks = tasks.value.filter((task) => task.startedAt)
  const finishedTasks = tasks.value.filter((task) => task.startedAt && task.finishedAt)
  const totalMs = finishedTasks.reduce((total, task) => total + getTaskDurationMs(task), 0)
  const avgMs = finishedTasks.length ? Math.round(totalMs / finishedTasks.length) : 0
  return {
    total: formatDuration(totalMs),
    average: formatDuration(avgMs),
    running: startedTasks.filter((task) => task.status === 'running').length
  }
})
const costEstimate = computed(() => {
  const chars = scopedCommits.value.reduce(
    (total, commit) =>
      total + commit.subject.length + commit.body.length + commit.files.join('').length,
    0
  )
  const requests = Math.max(1, Object.keys(groupCommitsByDate(scopedCommits.value)).length)
  const estimatedWords = reportLevelIds.reduce((total, level) => total + getWordCount(level), 0)
  return { requests, tokens: Math.round(chars / 3.2 + requests * estimatedWords * 0.42) }
})

let liveNowTimer = window.setInterval(() => {
  if (tasks.value.some((task) => task.status === 'running')) liveNow.value = Date.now()
}, 1000)

const filteredCommits = computed(() => {
  const keyword = commitSearch.value.trim().toLowerCase()
  const sorted = [...scopedCommits.value].sort((a, b) => b.date.localeCompare(a.date))
  if (!keyword) return sorted.slice(0, 120)

  return sorted
    .filter((commit) => {
      const content = [
        commit.date,
        commit.shortHash,
        commit.author,
        commit.subject,
        commit.body,
        ...commit.files
      ]
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
  if (!commits.value.length) return t('emptyCommits')
  return `${reportLevels.value.find((level) => level.id === activeLevel.value)?.label ?? ''}${t('emptyReportSuffix')}`
})

function t(key: MessageKey): string {
  return messages[uiSettings.language][key] ?? messages['zh-CN'][key]
}

function detectBrowserLanguage(): AppLanguage {
  return resolveLanguage(navigator.language || navigator.languages?.[0] || '')
}

function detectBrowserTheme(): AppTheme {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function resolveLanguage(locale: string): AppLanguage {
  const normalized = locale.toLowerCase()
  if (normalized.startsWith('zh')) return 'zh-CN'
  if (normalized.startsWith('ja')) return 'ja-JP'
  if (normalized.startsWith('ko')) return 'ko-KR'
  return 'en-US'
}

function resolveTheme(theme: unknown): AppTheme {
  return theme === 'light' ? 'light' : 'dark'
}

function applyTheme(): void {
  document.documentElement.dataset.theme = uiSettings.theme
}

function toggleTheme(): void {
  uiSettings.theme = uiSettings.theme === 'dark' ? 'light' : 'dark'
  saveLocalSettings()
  statusMessage.value = `${t('theme')}：${uiSettings.theme === 'dark' ? t('darkTheme') : t('lightTheme')}`
}

async function initSystemLanguage(): Promise<void> {
  if (localStorage.getItem(SETTINGS_KEY)) return
  try {
    const previousLanguage = uiSettings.language
    uiSettings.language = resolveLanguage(await window.api.getSystemLocale())
    if (previousLanguage !== uiSettings.language) applyLanguageDefaults(previousLanguage)
    statusMessage.value = t('statusChooseRepo')
  } catch {
    statusMessage.value = t('statusChooseRepo')
  }
}

function applyLanguageDefaults(previousLanguage: AppLanguage): void {
  const previous = messages[previousLanguage]
  if (generateOptions.style === previous.professional) generateOptions.style = t('professional')
  if (generateOptions.style === previous.formal) generateOptions.style = t('formal')
  if (generateOptions.style === previous.resultFocused) generateOptions.style = t('resultFocused')
  if (generateOptions.style === previous.review) generateOptions.style = t('review')
  if (generateOptions.style === previous.casual) generateOptions.style = t('casual')
  if (generateOptions.audience === previous.defaultAudience)
    generateOptions.audience = t('defaultAudience')
  if (generateOptions.focus === previous.defaultFocus) generateOptions.focus = t('defaultFocus')
}

function setLanguage(language: AppLanguage): void {
  const previousLanguage = uiSettings.language
  uiSettings.language = language
  applyLanguageDefaults(previousLanguage)
  statusMessage.value = t('settingsSaved')
}

function localizeError(error: unknown, fallback = t('aiGenerateFailed')): string {
  const raw = error instanceof Error ? error.message : String(error || '')
  if (!raw) return fallback
  if (/Repository path does not exist/i.test(raw)) return t('chooseRepoFirst')
  if (/API endpoint is required/i.test(raw)) return t('fillEndpoint')
  if (/Model name is required/i.test(raw)) return t('fillModel')
  if (/No content returned from model/i.test(raw)) return t('aiGenerateFailed')
  return raw
}

watch(selectedReportId, () => {
  void nextTick(() => {
    if (editorEl.value) {
      editorEl.value.innerHTML = selectedReport.value?.html ?? ''
    }
  })
})

watch(
  () => uiSettings.theme,
  () => {
    applyTheme()
  },
  { immediate: true }
)

onUnmounted(() => {
  window.clearInterval(liveNowTimer)
  liveNowTimer = 0
  if (currentRunId.value) {
    canceledRunIds.add(currentRunId.value)
    void window.api.cancelAiRequests(currentRunId.value)
  }
})

function saveLocalSettings(): void {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      aiConfig: { ...aiConfig, apiKey: '' },
      generateOptions,
      filters,
      uiSettings
    })
  )
}

async function saveSettings(): Promise<void> {
  saveLocalSettings()
  await window.api.saveAiConfig({ ...aiConfig })
  isSettingsOpen.value = false
  statusMessage.value = t('settingsSaved')
}

async function loadSettings(): Promise<void> {
  const raw = localStorage.getItem(SETTINGS_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as {
        aiConfig?: Partial<AiConfig>
        generateOptions?: Partial<GenerateOptions>
        filters?: Partial<typeof filters>
        uiSettings?: Partial<UiSettings>
      }
      const previousLanguage = uiSettings.language
      if (parsed.uiSettings?.language)
        uiSettings.language = resolveLanguage(parsed.uiSettings.language)
      if (parsed.uiSettings?.theme) uiSettings.theme = resolveTheme(parsed.uiSettings.theme)
      Object.assign(aiConfig, parsed.aiConfig)
      Object.assign(generateOptions, parsed.generateOptions)
      generateOptions.wordCounts = normalizeWordCounts(parsed.generateOptions)
      Object.assign(filters, parsed.filters)
      filters.category = normalizeCategoryFilter(filters.category)
      if (previousLanguage !== uiSettings.language) applyLanguageDefaults(previousLanguage)
    } catch {
      localStorage.removeItem(SETTINGS_KEY)
    }
  }

  const secureConfig = await window.api.loadAiConfig()
  if (secureConfig) Object.assign(aiConfig, secureConfig)
}

function normalizeWordCounts(value: unknown): Record<ReportLevel, number> {
  const defaults = { ...generateOptions.wordCounts }
  const maybe = value as {
    wordCount?: unknown
    wordCounts?: Partial<Record<ReportLevel, unknown>>
  } | null
  const legacy = normalizeWordCount(maybe?.wordCount, 0)
  const base = legacy
    ? Object.fromEntries(reportLevelIds.map((level) => [level, legacy]))
    : defaults
  const next = { ...base } as Record<ReportLevel, number>

  for (const level of reportLevelIds) {
    next[level] = normalizeWordCount(maybe?.wordCounts?.[level], next[level])
  }

  return next
}

function normalizeWordCount(value: unknown, fallback: number): number {
  const count = Number(value)
  if (!Number.isFinite(count) || count <= 0) return fallback
  return Math.min(3000, Math.max(100, Math.floor(count)))
}

function getWordCount(level: ReportLevel): number {
  return normalizeWordCount(generateOptions.wordCounts[level], generateOptions.wordCounts.daily)
}

function normalizeCategoryFilter(value: unknown): CategoryFilter {
  const legacyMap: Record<string, CategoryFilter> = {
    全部: 'all',
    功能: 'feature',
    修复: 'fix',
    重构: 'refactor',
    测试: 'test',
    构建: 'build',
    文档: 'docs',
    配置: 'config',
    其他: 'other'
  }
  if (typeof value !== 'string') return 'all'
  if (value === 'all' || commitCategoryIds.includes(value as CommitCategory))
    return value as CategoryFilter
  return legacyMap[value] ?? 'all'
}

function getWorkspaceSnapshot(): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify({
      repositoryPath: repositoryPath.value,
      commits: commits.value,
      reports: reports.value,
      activeLevel: activeLevel.value,
      selectedReportId: selectedReportId.value,
      commitSearch: commitSearch.value,
      savedAt: new Date().toISOString()
    })
  ) as Record<string, unknown>
}

function saveWorkspace(): void {
  const snapshot = getWorkspaceSnapshot()
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(snapshot))
  void window.api.saveWorkspace(snapshot)
}

async function loadWorkspace(): Promise<void> {
  let parsed = (await window.api.loadWorkspace()) as {
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
  selectedReportId.value =
    parsed?.selectedReportId &&
    reports.value.some((report) => report.id === parsed?.selectedReportId)
      ? parsed.selectedReportId
      : (reports.value[0]?.id ?? '')
  commitSearch.value = parsed?.commitSearch ?? ''
  updateStats()
  statusMessage.value = parsed?.savedAt
    ? `${t('workspaceRestored')}：${new Date(parsed.savedAt).toLocaleString(uiSettings.language)}`
    : t('workspaceRestored')
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
  statusMessage.value = t('workspaceCleared')
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
    statusMessage.value = `${t('readFailed')}：${localizeError(error)}`
  }
}

async function loadCommits(): Promise<void> {
  if (!repositoryPath.value.trim()) {
    errorMessage.value = t('chooseRepoFirst')
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  statusMessage.value = t('readingCommits')

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
    statusMessage.value = `${t('read')} ${commits.value.length} ${t('commits')}`
  } catch (error) {
    errorMessage.value = localizeError(error, t('readCommitsFailed'))
    statusMessage.value = t('readFailed')
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
    errorMessage.value = t('noCommitsForReport')
    return
  }

  if (!validateAiConfig()) return

  errorMessage.value = ''
  isGenerating.value = true
  const runId = beginGenerationRun()
  enqueueGenerationPlan(createGenerationPlan(runId), [level])

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
    if (isCancelError(error)) {
      statusMessage.value = t('canceled')
    } else {
      errorMessage.value = localizeError(error, t('aiGenerateFailed'))
      statusMessage.value = t('aiGenerateFailed')
    }
  } finally {
    finishGenerationRun(runId)
  }
}

async function generateAllReports(): Promise<void> {
  if (!commits.value.length) {
    errorMessage.value = t('noCommitsForReport')
    return
  }

  if (!validateAiConfig()) return

  errorMessage.value = ''
  isGenerating.value = true
  const runId = beginGenerationRun()
  enqueueGenerationPlan(createGenerationPlan(runId), reportLevelIds)

  try {
    await generateDailyReports()
    await generateWeeklyReports()
    await generateMonthlyReports()
    await generateFinalSummary()
    await generateDevelopmentLogs()
    activeLevel.value = 'summary'
    selectedReportId.value =
      reports.value.find((report) => report.level === 'devlog')?.id ??
      reports.value.find((report) => report.level === 'summary')?.id ??
      ''
    saveWorkspace()
    statusMessage.value = t('allDone')
  } catch (error) {
    if (isCancelError(error)) {
      statusMessage.value = t('canceled')
    } else {
      errorMessage.value = localizeError(error, t('aiGenerateFailed'))
      statusMessage.value = t('aiGenerateFailed')
    }
  } finally {
    finishGenerationRun(runId)
  }
}

async function generateDailyReports(): Promise<void> {
  const grouped = groupCommitsByDate(scopedCommits.value)
  const entries = Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a))
  const runId = getActiveRunId()
  const entryTasks = ensurePlanTasks(
    'daily',
    entries.map(([date]) => `${date} ${t('daily')}`)
  )
  activatePlannedTasks(entryTasks)
  let completed = 0

  const dailyReports = await runWithConcurrency(
    entries,
    getConcurrency(),
    async ([date, dayCommits], index) => {
      const task = entryTasks[index]
      if (shouldCancelRun(runId)) return null
      startTask(task)
      statusMessage.value = `正在并发生成日报 ${completed + 1}/${entries.length}：${date}`
      try {
        await waitForRequestSlot(index, runId)
        const summary = analyzeCommits(dayCommits)
        const html = await retryAsync(
          () =>
            requestAiHtml(
              '日报',
              `${date} 日报`,
              {
                period: date,
                commitCount: dayCommits.length,
                themes: summary.themes,
                modules: summary.modules,
                risks: summary.risks,
                category: categoryLabel(categorizeCommit(dayCommits[0])),
                commits: compactCommits(dayCommits)
              },
              task
            ),
          task,
          getRetryCount(),
          getRetryBackoff(),
          runId
        )
        completed += 1
        finishTask(task, 'success')
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
        finishTask(
          task,
          isCancelError(error) ? 'canceled' : 'failed',
          isCancelError(error) ? '' : error
        )
        return null
      }
    }
  )

  throwIfCanceled(runId)

  const successfulReports = dailyReports.filter((report): report is Report => Boolean(report))
  replaceReports('daily', successfulReports)
  statusMessage.value = `已生成 ${successfulReports.length} 份日报，失败 ${dailyReports.length - successfulReports.length} 份`
}

async function generateWeeklyReports(): Promise<void> {
  await ensureReports('daily')
  const grouped = groupReportsByKey('daily', (report) => getWeekKey(report.period))
  const entries = Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a))
  const runId = getActiveRunId()
  const entryTasks = ensurePlanTasks(
    'weekly',
    entries.map(([week]) => `${week} ${t('weekly')}`)
  )
  activatePlannedTasks(entryTasks)
  let completed = 0

  const weeklyReports = await runWithConcurrency(
    entries,
    getConcurrency(),
    async ([week, weekReports], index) => {
      const task = entryTasks[index]
      if (shouldCancelRun(runId)) return null
      startTask(task)
      statusMessage.value = `正在并发生成周报 ${completed + 1}/${entries.length}：${week}`
      try {
        await waitForRequestSlot(index, runId)
        const sourceDates = weekReports.flatMap((report) => report.sourcePeriods)
        const weekCommits = scopedCommits.value.filter((commit) =>
          sourceDates.includes(commit.date)
        )
        const summary = analyzeCommits(weekCommits)
        const html = await retryAsync(
          () =>
            requestAiHtml(
              '周报',
              `${week} 周报`,
              {
                period: week,
                sourceReports: compactReports(weekReports),
                commitCount: weekCommits.length,
                themes: summary.themes,
                modules: summary.modules,
                risks: summary.risks
              },
              task
            ),
          task,
          getRetryCount(),
          getRetryBackoff(),
          runId
        )
        completed += 1
        finishTask(task, 'success')
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
        finishTask(
          task,
          isCancelError(error) ? 'canceled' : 'failed',
          isCancelError(error) ? '' : error
        )
        return null
      }
    }
  )

  throwIfCanceled(runId)

  const successfulReports = weeklyReports.filter((report): report is Report => Boolean(report))
  replaceReports('weekly', successfulReports)
  statusMessage.value = `已生成 ${successfulReports.length} 份周报，失败 ${weeklyReports.length - successfulReports.length} 份`
}

async function generateMonthlyReports(): Promise<void> {
  await ensureReports('weekly')
  const grouped = groupReportsByKey(
    'weekly',
    (report) => report.sourcePeriods[0]?.slice(0, 7) ?? report.period
  )
  const entries = Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a))
  const runId = getActiveRunId()
  const entryTasks = ensurePlanTasks(
    'monthly',
    entries.map(([month]) => `${month} ${t('monthly')}`)
  )
  activatePlannedTasks(entryTasks)
  let completed = 0

  const monthlyReports = await runWithConcurrency(
    entries,
    getConcurrency(),
    async ([month, monthReports], index) => {
      const task = entryTasks[index]
      if (shouldCancelRun(runId)) return null
      startTask(task)
      statusMessage.value = `正在并发生成月报 ${completed + 1}/${entries.length}：${month}`
      try {
        await waitForRequestSlot(index, runId)
        const sourceDates = monthReports.flatMap((report) => report.sourcePeriods)
        const monthCommits = scopedCommits.value.filter((commit) =>
          sourceDates.includes(commit.date)
        )
        const summary = analyzeCommits(monthCommits)
        const html = await retryAsync(
          () =>
            requestAiHtml(
              '月报',
              `${month} 月报`,
              {
                period: month,
                sourceReports: compactReports(monthReports),
                commitCount: monthCommits.length,
                themes: summary.themes,
                modules: summary.modules,
                risks: summary.risks
              },
              task
            ),
          task,
          getRetryCount(),
          getRetryBackoff(),
          runId
        )
        completed += 1
        finishTask(task, 'success')
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
        finishTask(
          task,
          isCancelError(error) ? 'canceled' : 'failed',
          isCancelError(error) ? '' : error
        )
        return null
      }
    }
  )

  throwIfCanceled(runId)

  const successfulReports = monthlyReports.filter((report): report is Report => Boolean(report))
  replaceReports('monthly', successfulReports)
  statusMessage.value = `已生成 ${successfulReports.length} 份月报，失败 ${monthlyReports.length - successfulReports.length} 份`
}

async function generateDevelopmentLogs(): Promise<void> {
  const grouped = groupCommitsByDate(scopedCommits.value)
  const entries = Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a))
  const runId = getActiveRunId()
  const entryTasks = ensurePlanTasks(
    'devlog',
    entries.map(([date]) => `${date} ${t('devlog')}`)
  )
  activatePlannedTasks(entryTasks)
  let completed = 0

  const devlogEntries = await runWithConcurrency(
    entries,
    getConcurrency(),
    async ([date, dayCommits], index) => {
      const task = entryTasks[index]
      if (shouldCancelRun(runId)) return null
      startTask(task)
      statusMessage.value = `正在并发生成开发日志 ${completed + 1}/${entries.length}：${date}`
      try {
        await waitForRequestSlot(index, runId)
        const summary = analyzeCommits(dayCommits)
        const titleHint = inferDevelopmentLogTitle(date, dayCommits, summary)
        const html = await retryAsync(
          () =>
            requestAiHtml(
              '开发日志',
              titleHint,
              {
                period: date,
                requiredStructure: ['标题：YYYY-MM-DD — 主题', '背景', '核实', '修改', '验证'],
                writingMode:
                  '工程开发日志，写清楚为什么改、怎么核实、改了哪些文件/配置、怎么验证。语气可以具体、直接，避免空泛日报腔。',
                commitCount: dayCommits.length,
                themes: summary.themes,
                modules: summary.modules,
                risks: summary.risks,
                commits: compactCommits(dayCommits)
              },
              task
            ),
          task,
          getRetryCount(),
          getRetryBackoff(),
          runId
        )
        completed += 1
        finishTask(task, 'success')
        statusMessage.value = `开发日志已完成 ${completed}/${entries.length}`
        return {
          date,
          markdown: normalizeDevlogMarkdown(date, titleHint, html),
          commitCount: dayCommits.length,
          fileCount: summary.files.length
        }
      } catch (error) {
        finishTask(
          task,
          isCancelError(error) ? 'canceled' : 'failed',
          isCancelError(error) ? '' : error
        )
        return null
      }
    }
  )

  throwIfCanceled(runId)

  const successfulEntries = devlogEntries.filter(
    (entry): entry is { date: string; markdown: string; commitCount: number; fileCount: number } =>
      Boolean(entry)
  )
  const previousReport = reports.value.find((report) => report.id === DEVLOG_REPORT_ID)
  const mergedMarkdown = mergeDevlogMarkdown(
    previousReport?.markdown ?? htmlToMarkdown(previousReport?.html ?? ''),
    successfulEntries
  )
  const periods = getDevlogPeriods(mergedMarkdown)
  const commitCount =
    successfulEntries.reduce((total, entry) => total + entry.commitCount, 0) ||
    previousReport?.commitCount ||
    0
  const fileCount =
    successfulEntries.reduce((total, entry) => total + entry.fileCount, 0) ||
    previousReport?.fileCount ||
    0

  replaceReports('devlog', [
    createReport({
      id: DEVLOG_REPORT_ID,
      level: 'devlog',
      title: 'DEVELOPMENT_LOG.md',
      period: periods.length
        ? `${periods[periods.length - 1]} 至 ${periods[0]}`
        : getDateRange(scopedCommits.value),
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
  const runId = getActiveRunId()
  const [task] = ensurePlanTasks('summary', [t('projectSummary')])
  if (task) activatePlannedTasks([task])
  if (shouldCancelRun(runId)) return
  startTask(task)
  const monthlyReports = reports.value.filter((report) => report.level === 'monthly')
  const summary = analyzeCommits(scopedCommits.value)
  const dateRange = getDateRange(scopedCommits.value)
  statusMessage.value = `${t('generating')} ${t('summary')}`

  try {
    const html = await retryAsync(
      () =>
        requestAiHtml(
          t('summary'),
          t('projectSummary'),
          {
            period: dateRange,
            sourceReports: compactReports(monthlyReports),
            commitCount: scopedCommits.value.length,
            changedFileCount: summary.files.length,
            themes: summary.themes,
            modules: summary.modules,
            risks: summary.risks,
            authors: summary.authors
          },
          task
        ),
      task,
      getRetryCount(),
      getRetryBackoff(),
      runId
    )

    replaceReports('summary', [
      createReport({
        id: 'summary-all',
        level: 'summary',
        title: t('projectSummary'),
        period: dateRange,
        commitCount: scopedCommits.value.length,
        fileCount: summary.files.length,
        sourcePeriods: monthlyReports.map((report) => report.period),
        html
      })
    ])
    finishTask(task, 'success')
    statusMessage.value = `${t('summary')} ${t('success')}`
  } catch (error) {
    finishTask(
      task,
      isCancelError(error) ? 'canceled' : 'failed',
      isCancelError(error) ? '' : error
    )
    throw error
  }
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

async function waitForRequestSlot(index: number, runId: string): Promise<void> {
  const interval = getRequestInterval()
  if (!interval) return
  await sleep(interval * (index % getConcurrency()), runId)
}

async function retryAsync<T>(
  operation: () => Promise<T>,
  task: GenerationTask,
  retryCount: number,
  backoffMs: number,
  runId: string
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      throwIfCanceled(runId)
      task.attempts = attempt + 1
      return await operation()
    } catch (error) {
      lastError = error
      if (isCancelError(error) || shouldCancelRun(runId)) throw error
      if (attempt < retryCount) await sleep(backoffMs * (attempt + 1), runId)
    }
  }
  throw lastError
}

function sleep(ms: number, runId?: string): Promise<void> {
  if (!ms) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const timer = window.setInterval(
      () => {
        if (runId && shouldCancelRun(runId)) {
          window.clearInterval(timer)
          reject(new Error('AI request canceled'))
          return
        }
        if (Date.now() - startedAt >= ms) {
          window.clearInterval(timer)
          resolve()
        }
      },
      Math.min(250, ms)
    )
  })
}

function beginGenerationRun(): string {
  const runId = `run-${Date.now()}-${Math.random().toString(16).slice(2)}`
  tasks.value = []
  canceledRunIds.delete(runId)
  currentRunId.value = runId
  return runId
}

function createGenerationPlan(runId: string): GenerationPlan {
  const dayEntries = Object.entries(groupCommitsByDate(scopedCommits.value)).sort(([a], [b]) =>
    b.localeCompare(a)
  )
  const weeks = [...new Set(dayEntries.map(([date]) => getWeekKey(date)))].sort((a, b) =>
    b.localeCompare(a)
  )
  const months = [...new Set(dayEntries.map(([date]) => date.slice(0, 7)))].sort((a, b) =>
    b.localeCompare(a)
  )

  return {
    daily: dayEntries.map(([date]) => createTask(runId, 'daily', `${date} ${t('daily')}`)),
    weekly: weeks.map((week) => createTask(runId, 'weekly', `${week} ${t('weekly')}`, 'blocked')),
    monthly: months.map((month) =>
      createTask(runId, 'monthly', `${month} ${t('monthly')}`, 'blocked')
    ),
    summary: [createTask(runId, 'summary', t('projectSummary'), 'blocked')],
    devlog: dayEntries.map(([date]) => createTask(runId, 'devlog', `${date} ${t('devlog')}`))
  }
}

function enqueueGenerationPlan(plan: GenerationPlan, levels: ReportLevel[]): void {
  tasks.value.push(...levels.flatMap((level) => plan[level]))
}

function getPlanTasks(level: ReportLevel): GenerationTask[] {
  return tasks.value.filter((task) => task.level === level && task.runId === currentRunId.value)
}

function ensurePlanTasks(level: ReportLevel, titles: string[]): GenerationTask[] {
  const runId = getActiveRunId()
  const existing = getPlanTasks(level)
  const missing = titles
    .slice(existing.length)
    .map((title) =>
      createTask(
        runId,
        level,
        title,
        level === 'daily' || level === 'devlog' ? 'pending' : 'blocked'
      )
    )
  if (missing.length) tasks.value.push(...missing)
  return [...existing, ...missing]
}

function activatePlannedTasks(tasksToActivate: GenerationTask[]): void {
  for (const task of tasksToActivate) {
    if (task.status === 'blocked') task.status = 'pending'
  }
}

function finishGenerationRun(runId: string): void {
  markPendingTasksCanceled(runId)
  if (currentRunId.value === runId) {
    currentRunId.value = ''
    isGenerating.value = false
  }
  canceledRunIds.delete(runId)
}

async function cancelGeneration(): Promise<void> {
  const runId = currentRunId.value
  if (!runId) return
  canceledRunIds.add(runId)
  currentRunId.value = ''
  markPendingTasksCanceled(runId)
  for (const task of tasks.value.filter(
    (item) => item.runId === runId && item.status === 'running'
  )) {
    finishTask(task, 'canceled')
  }
  await window.api.cancelAiRequests(runId)
  isGenerating.value = false
  statusMessage.value = t('canceled')
}

function createTask(
  runId: string,
  level: ReportLevel,
  title: string,
  status: TaskStatus = 'pending'
): GenerationTask {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    runId,
    level,
    title,
    status,
    error: '',
    queuedAt: Date.now(),
    attempts: 0
  }
}

function startTask(task: GenerationTask): void {
  task.status = 'running'
  task.startedAt = Date.now()
  task.finishedAt = undefined
  task.error = ''
}

function finishTask(
  task: GenerationTask,
  status: Exclude<TaskStatus, 'pending' | 'running'>,
  error?: unknown
): void {
  if (task.status === status && task.finishedAt) return
  task.status = status
  task.finishedAt = Date.now()
  task.error = error ? localizeError(error) : ''
}

function markPendingTasksCanceled(runId: string): void {
  for (const task of tasks.value.filter(
    (item) => item.runId === runId && (item.status === 'pending' || item.status === 'blocked')
  )) {
    finishTask(task, 'canceled')
  }
}

function getActiveRunId(): string {
  if (!currentRunId.value) currentRunId.value = beginGenerationRun()
  return currentRunId.value
}

function shouldCancelRun(runId: string): boolean {
  return canceledRunIds.has(runId) || currentRunId.value !== runId
}

function throwIfCanceled(runId: string): void {
  if (shouldCancelRun(runId)) throw new Error('AI request canceled')
}

function isCancelError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '')
  return /canceled|cancelled|aborted|abort/i.test(message)
}

function getTaskDurationMs(task: GenerationTask): number {
  if (!task.startedAt) return 0
  const finishedAt = task.finishedAt ?? liveNow.value
  return Math.max(0, finishedAt - task.startedAt)
}

function getTaskQueueMs(task: GenerationTask): number {
  const startedAt = task.startedAt ?? task.finishedAt ?? liveNow.value
  return Math.max(0, startedAt - task.queuedAt)
}

function formatDuration(ms: number): string {
  if (!ms) return '0s'
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (!minutes) return `${seconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (!hours) return `${minutes}m ${seconds}s`
  return `${hours}h ${remainingMinutes}m`
}
function getConcurrency(): number {
  const concurrency = Number(generateOptions.concurrency)
  if (!Number.isFinite(concurrency)) return 1
  return Math.min(MAX_CONCURRENCY, Math.max(1, Math.floor(concurrency)))
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
      if (!currentRunId.value) break
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runWorker())
  await Promise.all(workers)
  return results
}

async function requestAiHtml(
  reportType: string,
  title: string,
  source: unknown,
  task: GenerationTask
): Promise<string> {
  const isDevLog = reportType === '开发日志'
  const systemPrompt = [
    isDevLog
      ? '你是资深工程师，负责把 Git 提交整理成工程开发日志。日志要像真实开发复盘，写清楚背景、核实过程、具体修改和验证结果。'
      : '你是资深研发经理和技术写作助手，负责根据 Git 提交记录或上一级报告生成研发工作报告。',
    '必须返回可直接放入富文本编辑器的 HTML 片段，只允许使用 h2、h3、p、ul、ol、li、strong、em、blockquote、br 标签。',
    '不要返回 Markdown，不要返回 ``` 代码块，不要包含 html/head/body/script/style 标签。',
    '内容必须忠于输入数据，不要编造不存在的任务、成员、业务背景或指标。',
    `输出语言：${t('outputLanguage')}。`,
    isDevLog
      ? '开发日志必须使用结构：h2 标题为“YYYY-MM-DD — 主题”，然后依次包含 h3“背景”、h3“核实”、h3“修改”、h3“验证”。每节用具体段落或列表写，不要写泛泛而谈的日报套话。'
      : '',
    `写作风格：${generateOptions.style}。`,
    `目标读者：${generateOptions.audience}。`,
    `目标字数：约 ${getWordCount(task.level)} 字。`,
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
    requestId: `${task.runId}:${task.id}`,
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
    errorMessage.value = t('fillEndpoint')
    return false
  }

  if (!aiConfig.model.trim()) {
    errorMessage.value = t('fillModel')
    return false
  }

  saveSettings()
  return true
}

async function testApiConnection(): Promise<void> {
  isTestingApi.value = true
  try {
    const result = await window.api.testAiConfig({ ...aiConfig, maxTokens: 32 })
    statusMessage.value = `API OK: ${result}`
    await window.api.saveAiConfig({ ...aiConfig })
  } catch (error) {
    errorMessage.value = localizeError(error, t('apiTestFailed'))
    statusMessage.value = t('apiTestFailed')
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

function setEditorBlock(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (!value) return
  runEditorCommand('formatBlock', value)
}

function setEditorFontSize(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (!value) return
  runEditorCommand('fontSize', value)
}

function createEditorLink(): void {
  const url = window.prompt('URL')?.trim()
  if (!url) return
  runEditorCommand('createLink', url)
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
  await navigator.clipboard.writeText(
    selectedReport.value.markdown ?? htmlToText(selectedReport.value.html)
  )
  statusMessage.value = t('copied')
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
  statusMessage.value = savedPath
    ? `${format.toUpperCase()} exported: ${savedPath}`
    : t('exportCanceled')
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

  const markdown = mergeDevlogMarkdown(
    '',
    devlogReports.map((report) => ({
      date: report.period.slice(0, 10),
      markdown: report.markdown ?? htmlToMarkdown(report.html),
      commitCount: report.commitCount,
      fileCount: report.fileCount
    }))
  )
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

function groupReportsByKey(
  level: ReportLevel,
  getKey: (report: Report) => string
): Record<string, Report[]> {
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
    if (filters.category !== 'all' && categorizeCommit(commit) !== filters.category) return false
    if (filters.fileKeyword.trim()) {
      const keyword = filters.fileKeyword.trim().toLowerCase()
      if (!commit.files.some((file) => file.toLowerCase().includes(keyword))) return false
    }
    return true
  })
}

function categorizeCommit(commit: GitCommit): CommitCategory {
  const text = `${commit.subject} ${commit.body} ${commit.files.join(' ')}`.toLowerCase()
  if (/doc|readme|文档/.test(text)) return 'docs'
  if (/test|spec|测试/.test(text)) return 'test'
  if (/build|ci|release|deploy|打包/.test(text)) return 'build'
  if (/config|env|package|lock|配置/.test(text)) return 'config'
  if (/refactor|重构/.test(text)) return 'refactor'
  if (/fix|bug|修复/.test(text)) return 'fix'
  if (/feat|feature|add|新增|增加/.test(text)) return 'feature'
  return 'other'
}

function categoryLabel(category: CommitCategory | 'all'): string {
  return t(category)
}
function inferRisks(subjects: string[], files: string[]): string[] {
  const risks: string[] = []
  const uniqueFiles = new Set(files)
  const joinedSubjects = subjects.join(' ').toLowerCase()

  if (uniqueFiles.size > 20) risks.push('改动文件较多，建议回归核心流程')
  if (joinedSubjects.includes('wip') || joinedSubjects.includes('todo'))
    risks.push('存在未完成语义，需要确认收口计划')
  if (files.some((file) => /config|package|lock|vite|electron|tsconfig/i.test(file))) {
    risks.push('涉及配置或依赖，建议关注构建稳定性')
  }

  return risks.length ? risks : ['未发现明显风险']
}

function inferDevelopmentLogTitle(
  date: string,
  dayCommits: GitCommit[],
  summary: ReturnType<typeof analyzeCommits>
): string {
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

function mergeDevlogMarkdown(
  existingMarkdown: string,
  entries: Array<{ date: string; markdown: string }>
): string {
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
  const trimmed = content
    .trim()
    .replace(/^```(?:html)?/i, '')
    .replace(/```$/i, '')
    .trim()
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
  if (parts.length >= 2 && ['src', 'app', 'packages'].includes(parts[0]))
    return `${parts[0]}/${parts[1]}`
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
  const week =
    1 +
    Math.round(
      ((date.getTime() - weekOne.getTime()) / 86400000 - 3 + ((weekOne.getDay() + 6) % 7)) / 7
    )
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
      <div class="titlebar-title">{{ t('appTitle') }}</div>
      <div class="titlebar-status">{{ statusMessage }}</div>
      <div class="titlebar-actions">
        <button type="button" @click="toggleTheme">
          {{ uiSettings.theme === 'dark' ? t('lightTheme') : t('darkTheme') }}
        </button>
        <button type="button" @click="isSettingsOpen = true">{{ t('settings') }}</button>
        <button
          type="button"
          :disabled="!commits.length && !reports.length"
          @click="clearWorkspace"
        >
          {{ t('clear') }}
        </button>
      </div>
    </header>

    <aside class="explorer">
      <section class="explorer-section repo-block">
        <div class="explorer-title">
          <span>{{ t('repository') }}</span
          ><small>{{ branches.length }} branches</small>
        </div>
        <label class="field compact"
          >{{ t('path')
          }}<input v-model="repositoryPath" type="text" placeholder="D:\\Projects\\repo"
        /></label>
        <div class="button-row">
          <button type="button" @click="selectRepository">{{ t('select') }}</button>
          <button
            type="button"
            class="primary"
            :disabled="isLoading || isGenerating"
            @click="loadCommits"
          >
            {{ isLoading ? t('reading') : t('read') }}
          </button>
        </div>
      </section>

      <section class="explorer-section">
        <div class="explorer-title">
          <span>{{ t('reportTypes') }}</span
          ><small>{{ reports.length }} reports</small>
        </div>
        <div class="report-tabs">
          <button
            v-for="level in reportLevels"
            :key="level.id"
            type="button"
            :class="{ active: activeLevel === level.id }"
            @click="setActiveLevel(level.id)"
          >
            <span>{{ level.label }}</span
            ><strong>{{ reports.filter((report) => report.level === level.id).length }}</strong>
          </button>
        </div>
      </section>

      <section class="explorer-section filters-block">
        <div class="explorer-title">
          <span>{{ t('filters') }}</span
          ><small>{{ scopedCommits.length }} commits</small>
        </div>
        <label class="field compact"
          >{{ t('branch')
          }}<select v-model="filters.branch" @change="loadCommits">
            <option value="">{{ t('currentBranch') }}</option>
            <option v-for="branch in branches" :key="branch" :value="branch">{{ branch }}</option>
          </select></label
        >
        <div class="field-pair">
          <label class="field compact"
            >{{ t('start') }}<input v-model="filters.since" type="date"
          /></label>
          <label class="field compact"
            >{{ t('end') }}<input v-model="filters.until" type="date"
          /></label>
        </div>
        <label class="field compact"
          >{{ t('author')
          }}<select v-model="filters.author">
            <option value="">{{ t('allAuthors') }}</option>
            <option v-for="author in authorOptions" :key="author" :value="author">
              {{ author }}
            </option>
          </select></label
        >
        <label class="field compact"
          >{{ t('keyword')
          }}<input v-model="filters.keyword" type="text" placeholder="feat / fix / docs"
        /></label>
        <div class="field-pair">
          <label class="field compact"
            >{{ t('category')
            }}<select v-model="filters.category">
              <option value="all">{{ categoryLabel('all') }}</option>
              <option v-for="categoryId in commitCategoryIds" :key="categoryId" :value="categoryId">
                {{ categoryLabel(categoryId) }}
              </option>
            </select></label
          >
          <label class="field compact"
            >{{ t('file') }}<input v-model="filters.fileKeyword" type="text" placeholder="src/api"
          /></label>
        </div>
        <button type="button" class="full" @click="loadCommits">{{ t('applyFilters') }}</button>
      </section>

      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    </aside>

    <section class="editor-workspace">
      <section class="commandbar" :aria-label="t('generate')">
        <div class="commandbar-group">
          <span class="commandbar-label">{{ t('generate') }}</span>
          <button
            v-for="level in reportLevels"
            :key="level.action"
            type="button"
            :disabled="!scopedCommits.length || isGenerating"
            @click="generateReports(level.id)"
          >
            {{ level.label }}
          </button>
        </div>
        <div class="commandbar-spacer"></div>
        <div class="quick-settings" :aria-label="t('generationSettings')">
          <label class="quick-field"
            >{{ t('language')
            }}<select
              :value="uiSettings.language"
              @change="setLanguage(($event.target as HTMLSelectElement).value as AppLanguage)"
            >
              <option v-for="language in languageOptions" :key="language.id" :value="language.id">
                {{ language.label }}
              </option>
            </select></label
          >
          <label class="quick-field compact"
            >{{ t('concurrency')
            }}<input
              v-model.number="generateOptions.concurrency"
              type="number"
              min="1"
              :max="MAX_CONCURRENCY"
          /></label>
        </div>
        <button v-if="isGenerating" type="button" class="danger" @click="cancelGeneration">
          {{ t('cancelGeneration') }}
        </button>
        <button
          type="button"
          class="primary"
          :disabled="!scopedCommits.length || isGenerating"
          @click="generateAllReports"
        >
          {{ isGenerating ? t('generating') : t('generateAll') }}
        </button>
      </section>

      <section class="metrics-bar">
        <div class="metric">
          <strong>{{ scopedCommits.length }}</strong
          ><span>{{ t('commits') }}</span>
        </div>
        <div class="metric">
          <strong>{{ stats.days }}</strong
          ><span>{{ t('days') }}</span>
        </div>
        <div class="metric">
          <strong>{{ stats.weeks }}</strong
          ><span>{{ t('weeks') }}</span>
        </div>
        <div class="metric">
          <strong>{{ stats.months }}</strong
          ><span>{{ t('months') }}</span>
        </div>
        <div class="metric">
          <strong>{{ stats.files }}</strong
          ><span>{{ t('files') }}</span>
        </div>
        <div class="metric">
          <strong>{{ costEstimate.tokens }}</strong
          ><span>Token</span>
        </div>
        <div class="repo-path">{{ repositoryPath || t('noRepository') }}</div>
      </section>

      <section class="workbench">
        <aside class="report-sidebar">
          <div class="panel-heading">
            <h2>{{ reportLevels.find((level) => level.id === activeLevel)?.label }}</h2>
            <span>{{ visibleReports.length }}</span>
          </div>
          <div class="report-list">
            <button
              v-for="report in visibleReports"
              :key="report.id"
              type="button"
              class="report-entry"
              :class="{ active: selectedReportId === report.id }"
              @click="selectReport(report)"
            >
              <strong>{{ report.title }}</strong>
              <span
                >{{ report.commitCount }} {{ t('commits') }} · {{ report.fileCount }}
                {{ t('files') }}</span
              >
            </button>
            <div v-if="!visibleReports.length" class="empty-state">{{ emptyState }}</div>
          </div>
        </aside>

        <section class="document-pane">
          <header class="tabbar">
            <div class="tab active">{{ selectedReport?.title || 'welcome.md' }}</div>
            <div class="editor-actions">
              <button type="button" :disabled="!selectedReport" @click="copyReport">
                {{ t('copy') }}
              </button>
              <button
                type="button"
                :disabled="!selectedReport"
                @click="exportSelectedReport('doc')"
              >
                Word
              </button>
              <button
                type="button"
                :disabled="!selectedReport"
                @click="exportSelectedReport('html')"
              >
                HTML
              </button>
              <button type="button" :disabled="!selectedReport" @click="exportSelectedReport('md')">
                MD
              </button>
              <button
                type="button"
                :disabled="!selectedReport"
                @click="exportSelectedReport('pdf')"
              >
                PDF
              </button>
            </div>
          </header>
          <div class="toolbar" role="toolbar" :aria-label="t('heading')">
            <button
              type="button"
              :disabled="!selectedReport"
              :title="t('undo')"
              @click="runEditorCommand('undo')"
            >
              <span>↶</span>
            </button>
            <button
              type="button"
              :disabled="!selectedReport"
              :title="t('redo')"
              @click="runEditorCommand('redo')"
            >
              <span>↷</span>
            </button>
            <select :disabled="!selectedReport" :aria-label="t('heading')" @change="setEditorBlock">
              <option value="p">{{ t('paragraph') }}</option>
              <option value="h2">{{ t('heading2') }}</option>
              <option value="h3">{{ t('heading3') }}</option>
              <option value="blockquote">{{ t('quote') }}</option>
            </select>
            <select
              :disabled="!selectedReport"
              :aria-label="t('fontSize')"
              @change="setEditorFontSize"
            >
              <option value="3">{{ t('fontSize') }}</option>
              <option value="2">12px</option>
              <option value="3">14px</option>
              <option value="4">16px</option>
              <option value="5">20px</option>
            </select>
            <button
              type="button"
              :disabled="!selectedReport"
              :title="t('bold')"
              @click="runEditorCommand('bold')"
            >
              <span>B</span>
            </button>
            <button
              type="button"
              :disabled="!selectedReport"
              :title="t('italic')"
              @click="runEditorCommand('italic')"
            >
              <span>I</span>
            </button>
            <button
              type="button"
              :disabled="!selectedReport"
              :title="t('underline')"
              @click="runEditorCommand('underline')"
            >
              <span>U</span>
            </button>
            <button
              type="button"
              :disabled="!selectedReport"
              :title="t('list')"
              @click="runEditorCommand('insertUnorderedList')"
            >
              <span>•</span>
            </button>
            <button
              type="button"
              :disabled="!selectedReport"
              :title="t('orderedList')"
              @click="runEditorCommand('insertOrderedList')"
            >
              <span>1.</span>
            </button>
            <button
              type="button"
              :disabled="!selectedReport"
              :title="t('alignLeft')"
              @click="runEditorCommand('justifyLeft')"
            >
              <span>≡</span>
            </button>
            <button
              type="button"
              :disabled="!selectedReport"
              :title="t('alignCenter')"
              @click="runEditorCommand('justifyCenter')"
            >
              <span>≣</span>
            </button>
            <button
              type="button"
              :disabled="!selectedReport"
              :title="t('alignRight')"
              @click="runEditorCommand('justifyRight')"
            >
              <span>≡</span>
            </button>
            <button
              type="button"
              :disabled="!selectedReport"
              :title="t('outdent')"
              @click="runEditorCommand('outdent')"
            >
              <span>←</span>
            </button>
            <button
              type="button"
              :disabled="!selectedReport"
              :title="t('indent')"
              @click="runEditorCommand('indent')"
            >
              <span>→</span>
            </button>
            <button
              type="button"
              :disabled="!selectedReport"
              :title="t('link')"
              @click="createEditorLink"
            >
              <span>URL</span>
            </button>
            <button
              type="button"
              :disabled="!selectedReport"
              :title="t('removeFormat')"
              @click="runEditorCommand('removeFormat')"
            >
              <span>Tx</span>
            </button>
          </div>
          <article
            ref="editorEl"
            class="rich-editor"
            :class="{ disabled: !selectedReport }"
            :data-placeholder="t('chooseOrGenerateReport')"
            contenteditable="true"
            spellcheck="false"
            @input="syncEditor"
          />
        </section>

        <aside class="commit-pane">
          <div class="panel-heading">
            <h2>{{ t('commitRecords') }}</h2>
            <span>{{ filteredCommits.length }}</span>
          </div>
          <input
            v-model="commitSearch"
            class="commit-search"
            type="text"
            :placeholder="t('searchCommits')"
          />
          <div class="heatmap" :aria-label="t('commitRecords')">
            <span
              v-for="day in heatmapDays"
              :key="day.date"
              class="heat-cell"
              :class="`level-${day.level}`"
              :title="`${day.date}: ${day.count} 次提交`"
            />
          </div>
          <div class="commit-list">
            <article v-for="commit in filteredCommits" :key="commit.hash" class="commit-item">
              <div class="commit-line">
                <strong>{{ commit.subject }}</strong
                ><code>{{ commit.shortHash }}</code>
              </div>
              <div class="commit-meta">
                {{ commit.date }} · {{ commit.author }} ·
                {{ categoryLabel(categorizeCommit(commit)) }} · {{ commit.files.length }}
                {{ t('files') }}
              </div>
              <div v-if="commit.files.length" class="file-row">
                <span v-for="file in commit.files.slice(0, 4)" :key="file">{{ file }}</span
                ><span v-if="commit.files.length > 4">+{{ commit.files.length - 4 }}</span>
              </div>
            </article>
            <div v-if="!filteredCommits.length" class="empty-state small">{{ t('noCommits') }}</div>
          </div>
        </aside>
      </section>

      <footer class="panelbar" :class="{ open: tasks.length }">
        <div class="panelbar-header">
          <strong>{{ t('reportTasks') }}</strong>
          <span
            >{{ generationProgress }}% · {{ t('success') }} {{ taskStats.success }} ·
            {{ t('failed') }} {{ taskStats.failed }} · {{ t('canceled') }}
            {{ taskStats.canceled }} · {{ t('blocked') }} {{ taskStats.blocked }} ·
            {{ t('totalElapsed') }} {{ taskTimingStats.total }} · {{ t('avgElapsed') }}
            {{ taskTimingStats.average }}</span
          >
        </div>
        <div class="progress-track"><span :style="{ width: `${generationProgress}%` }" /></div>
        <div v-if="tasks.length" class="task-list">
          <article v-for="task in tasks" :key="task.id" class="task-item" :class="task.status">
            <strong>{{ task.title }}</strong>
            <span
              >{{ t(task.status) }} · {{ t('elapsed') }}
              {{ formatDuration(getTaskDurationMs(task)) }} · {{ t('queueElapsed') }}
              {{ formatDuration(getTaskQueueMs(task)) }} · {{ t('attempts') }} {{ task.attempts
              }}{{ task.error ? ` · ${task.error}` : '' }}</span
            >
            <button v-if="task.status === 'failed'" type="button" @click="retryFailedTask(task)">
              {{ t('retry') }}
            </button>
          </article>
        </div>
      </footer>
    </section>

    <div v-if="isSettingsOpen" class="modal-backdrop" @click.self="isSettingsOpen = false">
      <section
        class="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settingsTitle"
      >
        <div class="modal-header">
          <div>
            <h2 id="settingsTitle">{{ t('settingsTitle') }}</h2>
            <p>{{ t('settingsDescription') }}</p>
          </div>
          <button type="button" @click="isSettingsOpen = false">{{ t('close') }}</button>
        </div>
        <div class="settings-grid">
          <section class="modal-section">
            <div class="modal-section-title">{{ t('apiConfig') }}</div>
            <label class="field"
              >Base URL / Endpoint<input
                v-model="aiConfig.baseUrl"
                type="text"
                placeholder="https://api.openai.com 或完整 /chat/completions"
            /></label>
            <label class="field"
              >API Key<input v-model="aiConfig.apiKey" type="password" placeholder="sk-..."
            /></label>
            <div class="field-pair">
              <label class="field"
                >{{ t('model') }}<input v-model="aiConfig.model" type="text" /></label
              ><label class="field"
                >Max Tokens<input
                  v-model.number="aiConfig.maxTokens"
                  type="number"
                  min="256"
                  max="8000"
                  step="128"
              /></label>
            </div>
            <label class="field"
              >{{ t('temperature') }} {{ Number(aiConfig.temperature).toFixed(2)
              }}<input
                v-model.number="aiConfig.temperature"
                class="range-input"
                type="range"
                min="0"
                max="1"
                step="0.05"
            /></label>
            <label class="field"
              >{{ t('language')
              }}<select
                :value="uiSettings.language"
                @change="setLanguage(($event.target as HTMLSelectElement).value as AppLanguage)"
              >
                <option v-for="language in languageOptions" :key="language.id" :value="language.id">
                  {{ language.label }}
                </option></select
              ><small>{{ t('languageHint') }}</small></label
            >
            <label class="field"
              >{{ t('theme')
              }}<select v-model="uiSettings.theme">
                <option value="light">{{ t('lightTheme') }}</option>
                <option value="dark">{{ t('darkTheme') }}</option>
              </select></label
            >
            <button type="button" :disabled="isTestingApi" @click="testApiConnection">
              {{ isTestingApi ? t('testing') : t('testConnection') }}
            </button>
          </section>
          <section class="modal-section">
            <div class="modal-section-title">{{ t('generationSettings') }}</div>
            <div class="field-pair">
              <label class="field"
                >{{ t('style')
                }}<select v-model="generateOptions.style">
                  <option>{{ t('professional') }}</option>
                  <option>{{ t('formal') }}</option>
                  <option>{{ t('resultFocused') }}</option>
                  <option>{{ t('review') }}</option>
                  <option>{{ t('casual') }}</option>
                </select></label
              >
            </div>
            <div class="modal-section-title">{{ t('typeWordCounts') }}</div>
            <div class="field-triplet">
              <label v-for="level in reportLevelIds" :key="level" class="field"
                >{{ t(level)
                }}<input
                  v-model.number="generateOptions.wordCounts[level]"
                  type="number"
                  min="100"
                  max="3000"
                  step="50"
              /></label>
            </div>
            <div class="field-triplet">
              <label class="field"
                >{{ t('concurrency')
                }}<input
                  v-model.number="generateOptions.concurrency"
                  type="number"
                  min="1"
                  :max="MAX_CONCURRENCY" /></label
              ><label class="field"
                >{{ t('intervalMs')
                }}<input
                  v-model.number="generateOptions.requestIntervalMs"
                  type="number"
                  min="0"
                  max="10000"
                  step="100" /></label
              ><label class="field"
                >{{ t('retryCount')
                }}<input v-model.number="generateOptions.retryCount" type="number" min="0" max="5"
              /></label>
            </div>
            <p class="settings-hint">{{ t('concurrencyHint') }}</p>
            <label class="field"
              >{{ t('backoffMs')
              }}<input
                v-model.number="generateOptions.retryBackoffMs"
                type="number"
                min="0"
                max="10000"
                step="100"
            /></label>
            <label class="field"
              >{{ t('audience') }}<input v-model="generateOptions.audience" type="text"
            /></label>
            <label class="field"
              >{{ t('focus') }}<textarea v-model="generateOptions.focus" rows="2" />
            </label>
            <label class="field"
              >{{ t('extraPrompt')
              }}<textarea
                v-model="generateOptions.extraPrompt"
                rows="3"
                :placeholder="t('promptPlaceholder')"
              />
            </label>
          </section>
        </div>
        <div class="modal-footer">
          <button type="button" @click="isSettingsOpen = false">{{ t('cancel') }}</button
          ><button type="button" class="primary" @click="saveSettings">
            {{ t('saveSettings') }}
          </button>
        </div>
      </section>
    </div>
  </main>
</template>
