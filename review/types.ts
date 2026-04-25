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

export interface JournalReviewSnapshot {
    journalPath: string;
    journalName: string;
    anchor: ReviewAnchor;
    lookbacks: LookbackResult[];
    calendarSummaries: PeriodSummary[];
    rollingSummaries: PeriodSummary[];
    insights: ReviewInsights;
    entryCount: number;
}
