export interface JournalEntryRecord {
    journalPath: string;
    filePath: string;
    date: string;
    displayLabel: string;
}

export interface ReviewAnchor {
    date: string;
}

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
    weekdayDistribution: DistributionDatum[];
    monthlyActivity: DistributionDatum[];
}
