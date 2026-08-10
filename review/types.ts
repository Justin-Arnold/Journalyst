export interface JournalEntryRecord {
    journalPath: string;
    filePath: string;
    date: string;
    displayLabel: string;
    isComplete: boolean;
}

export interface ReviewAnchor {
    date: string;
}

export type ReviewWorkspaceTab = 'home' | 'journals' | 'review' | 'analytics' | 'synthesis' | 'reminders';
export type SynthesisPeriodType = 'weekly' | 'monthly' | 'quarterly';
export type SidebarMode = 'home-mini' | 'journals-mini';

export interface LookbackResult {
    label: string;
    targetDate: string;
    entry: JournalEntryRecord | null;
}

export interface ReviewLookbackPreview {
    label: string;
    targetDate: string;
    filePath: string | null;
    isComplete: boolean | null;
    title: string;
    excerpt: string | null;
}

export interface PeriodSummary {
    label: string;
    startDate: string;
    endDate: string;
    completedDays: number;
    totalDays: number;
    completionRate: number;
    tracked: boolean;
}

export interface ReviewInsights {
    currentStreak: number;
    longestStreak: number;
    longestMissStretch: number;
    totalEntries: number;
    busiestWeekday: string | null;
    busiestMonth: string | null;
    cadenceLabel: string;
    expectedToday: boolean;
    outstandingMisses: number;
    nextExpectedDate: string | null;
    isTracked: boolean;
}

export interface ActivityCell {
    date: string;
    hasEntry: boolean;
    isComplete: boolean;
    isExpected: boolean;
}

export type ReviewActivityCellState =
    | 'complete'
    | 'draft'
    | 'due'
    | 'missing-expected'
    | 'skipped'
    | 'future';

export interface ReviewActivityCell extends ActivityCell {
    filePath: string | null;
    isAnchor: boolean;
    state: ReviewActivityCellState;
}

export type ReviewTodayActionKind = 'write' | 'continue' | 'open' | 'go-to';

export interface ReviewTodayAction {
    kind: ReviewTodayActionKind;
    label: string;
    date: string;
}

export interface ReviewConfigurationInsights {
    promptSourceLabel: string;
    templateLabel: string;
}

export type AnalyticsSummaryMetricTone = 'neutral' | 'success' | 'warning';

export interface AnalyticsSummaryMetric {
    id: string;
    label: string;
    value: string;
    supportingText: string;
    comparisonText: string | null;
    comparisonTone: AnalyticsSummaryMetricTone;
}

export type AnalyticsInsightTone = 'neutral' | 'accent' | 'success' | 'warning';

export interface AnalyticsInsight {
    id: string;
    tone: AnalyticsInsightTone;
    icon: string;
    title: string;
    description: string;
}

export interface AnalyticsChartDatum {
    key: string;
    label: string;
    value: number;
    valueLabel: string;
    description: string;
    completedCount: number;
    totalCount: number;
    isHighlight: boolean;
    isEmpty: boolean;
}

export interface AnalyticsChartSeries {
    id: 'weekday' | 'monthly';
    title: string;
    description: string;
    totalLabel: string;
    data: AnalyticsChartDatum[];
}

export interface AnalyticsRankedWeek extends PeriodSummary {
    reviewAnchorDate: string;
}

export interface AnalyticsPerformanceMetric {
    id: 'expected-hit-rate' | 'finished-entry-rate';
    label: string;
    description: string;
    completed: number;
    total: number;
    percentage: number;
    tracked: boolean;
}

export type AnalyticsYearCellState =
    | 'complete'
    | 'draft'
    | 'missing-expected'
    | 'skipped'
    | 'future';

export interface YearActivityCell extends ActivityCell {
    filePath: string | null;
    monthLabel: string;
    dayLabel: string;
    state: AnalyticsYearCellState;
}

export interface JournalReviewSnapshot {
    journalPath: string;
    journalName: string;
    anchor: ReviewAnchor;
    lookbacks: LookbackResult[];
    calendarSummaries: PeriodSummary[];
    currentMonthSummary: PeriodSummary;
    rollingSummaries: PeriodSummary[];
    insights: ReviewInsights;
    entryCount: number;
    recentActivity: ReviewActivityCell[];
    todayAction: ReviewTodayAction;
    configurationInsights: ReviewConfigurationInsights;
}

export interface JournalAnalyticsSnapshot {
    journalPath: string;
    journalName: string;
    anchor: ReviewAnchor;
    effectiveAnchorDate: string;
    summaryMetrics: AnalyticsSummaryMetric[];
    patternInsights: AnalyticsInsight[];
    weekdayRhythm: AnalyticsChartSeries;
    monthlyVolume: AnalyticsChartSeries;
    yearActivity: YearActivityCell[];
    rankedWeeks: {
        strongest: AnalyticsRankedWeek | null;
        lowest: AnalyticsRankedWeek | null;
    };
    cadencePerformance: AnalyticsPerformanceMetric[];
    cadencePerformanceDescription: string;
    isAdHoc: boolean;
}

export interface SynthesisNotePayload {
    title: string;
    fileName: string;
    startDate: string;
    endDate: string;
    body: string;
}

export interface SynthesisNotePreview {
    periodType: SynthesisPeriodType;
    title: string;
    fileName: string;
    startDate: string;
    endDate: string;
    summary: PeriodSummary;
    notableEntries: JournalEntryRecord[];
    strongestPatterns: string[];
    weakestPatterns: string[];
    reflectionPrompts: string[];
    payload: SynthesisNotePayload;
}
