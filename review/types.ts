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
}

export interface ReviewInsights {
    currentStreak: number;
    longestStreak: number;
    longestGapDays: number;
    totalEntries: number;
    busiestWeekday: string | null;
    busiestMonth: string | null;
}

export interface ActivityCell {
    date: string;
    hasEntry: boolean;
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
