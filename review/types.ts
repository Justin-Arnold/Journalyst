export interface JournalEntryRecord {
    journalPath: string;
    filePath: string;
    date: string;
    displayLabel: string;
}

export interface ReviewAnchor {
    date: string;
}

export type ReviewWorkspaceTab = 'home' | 'review' | 'analytics' | 'synthesis';
export type SynthesisPeriodType = 'weekly' | 'monthly' | 'quarterly';
export type SidebarMode = 'home-mini' | 'journals-mini';

export interface LookbackResult {
    label: string;
    targetDate: string;
    entry: JournalEntryRecord | null;
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
    isExpected: boolean;
}

export interface DistributionDatum {
    label: string;
    value: number;
}

export interface RankedPeriod {
    label: string;
    startDate: string;
    endDate: string;
    completedDays: number;
    totalDays: number;
    completionRate: number;
}

export interface RollingComparison {
    label: string;
    current: PeriodSummary;
    previous: PeriodSummary;
    rateDelta: number;
}

export interface AnalyticsCallout {
    title: string;
    body: string;
}

export interface YearActivityCell extends ActivityCell {
    monthLabel: string;
    dayLabel: string;
    isFuture: boolean;
}

export interface JournalReviewSnapshot {
    journalPath: string;
    journalName: string;
    anchor: ReviewAnchor;
    lookbacks: LookbackResult[];
    calendarSummaries: PeriodSummary[];
    rollingSummaries: PeriodSummary[];
    insights: ReviewInsights;
    entryCount: number;
    recentActivity: ActivityCell[];
    reviewCallouts: AnalyticsCallout[];
}

export interface JournalAnalyticsSnapshot {
    journalPath: string;
    journalName: string;
    anchor: ReviewAnchor;
    insights: ReviewInsights;
    yearActivity: YearActivityCell[];
    weekdayDistribution: DistributionDatum[];
    monthlyActivity: DistributionDatum[];
    rollingComparisons: RollingComparison[];
    rankedPeriods: {
        best: RankedPeriod | null;
        worst: RankedPeriod | null;
    };
    callouts: AnalyticsCallout[];
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
