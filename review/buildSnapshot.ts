import { TFolder, moment } from 'obsidian';
import {
    getCadenceLabel,
    getCadenceStatus,
    getCurrentCadenceStreak,
    getExpectedDatesInRange,
    getLongestCadenceStreak,
    getLongestMissStretch,
    isCadenceTracked,
    isExpectedOnDate,
    normalizeJournalCadence,
} from '../cadence';
import { JournalDateSettings, parseJournalDateFromFile } from '../journalNaming';
import {
    ActivityCell,
    DistributionDatum,
    JournalEntryRecord,
    JournalReviewSnapshot,
    LookbackResult,
    PeriodSummary,
    ReviewInsights,
} from './types';

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function buildJournalReviewSnapshot(journal: TFolder, anchorDate: string, journalDateSettings: JournalDateSettings): JournalReviewSnapshot {
    const entries = getJournalEntries(journal, journalDateSettings);
    const entryByDate = new Map(entries.map(entry => [entry.date, entry]));
    const cadence = normalizeJournalCadence((journalDateSettings as JournalDateSettings & { journalCadences?: Record<string, import('../cadence').JournalCadenceConfig> }).journalCadences?.[journal.path]);
    const anchor = moment(anchorDate, 'YYYY-MM-DD', true);
    const normalizedAnchor = anchor.isValid() ? anchor : moment();
    const normalizedAnchorDate = normalizedAnchor.format('YYYY-MM-DD');
    const dateSet = new Set(entries.map(entry => entry.date));
    const firstEntryDate = entries[0]?.date ?? null;

    return {
        journalPath: journal.path,
        journalName: journal.name,
        anchor: { date: normalizedAnchorDate },
        lookbacks: buildLookbacks(normalizedAnchor, entryByDate),
        calendarSummaries: buildCalendarSummaries(normalizedAnchor, entryByDate, cadence),
        rollingSummaries: buildRollingSummaries(normalizedAnchor, entryByDate, cadence),
        insights: buildInsights(entries, normalizedAnchorDate, cadence),
        entryCount: entries.length,
        recentActivity: buildRecentActivity(normalizedAnchor, entryByDate, cadence),
        weekdayDistribution: buildWeekdayDistribution(entries),
        monthlyActivity: buildMonthlyActivity(entries, normalizedAnchor),
    };
}

function getJournalEntries(journal: TFolder, journalDateSettings: JournalDateSettings): JournalEntryRecord[] {
    return journal.children
        .map(file => {
            const date = parseJournalDateFromFile(file, journalDateSettings);

            if (!date) {
                return null;
            }

            return {
                journalPath: journal.path,
                filePath: file.path,
                date,
                displayLabel: date,
            };
        })
        .filter((entry): entry is JournalEntryRecord => entry !== null)
        .sort((left, right) => left.date.localeCompare(right.date));
}

function buildLookbacks(anchor: moment.Moment, entryByDate: Map<string, JournalEntryRecord>): LookbackResult[] {
    return [
        { label: 'Last week', targetDate: anchor.clone().subtract(1, 'week').format('YYYY-MM-DD') },
        { label: 'Last month', targetDate: anchor.clone().subtract(1, 'month').format('YYYY-MM-DD') },
        { label: 'Last quarter', targetDate: anchor.clone().subtract(1, 'quarter').format('YYYY-MM-DD') },
        { label: 'Last year', targetDate: anchor.clone().subtract(1, 'year').format('YYYY-MM-DD') },
    ].map(lookback => ({
        ...lookback,
        entry: entryByDate.get(lookback.targetDate) ?? null,
    }));
}

function buildCalendarSummaries(anchor: moment.Moment, entryByDate: Map<string, JournalEntryRecord>, cadence: import('../cadence').JournalCadenceConfig): PeriodSummary[] {
    return [
        createPeriodSummary('This week', anchor.clone().startOf('week'), anchor.clone(), entryByDate, cadence),
        createPeriodSummary('This month', anchor.clone().startOf('month'), anchor.clone(), entryByDate, cadence),
        createPeriodSummary('This quarter', anchor.clone().startOf('quarter'), anchor.clone(), entryByDate, cadence),
        createPeriodSummary('This year', anchor.clone().startOf('year'), anchor.clone(), entryByDate, cadence),
    ];
}

function buildRollingSummaries(anchor: moment.Moment, entryByDate: Map<string, JournalEntryRecord>, cadence: import('../cadence').JournalCadenceConfig): PeriodSummary[] {
    return [
        createRollingSummary('Last 7 days', 7, anchor, entryByDate, cadence),
        createRollingSummary('Last 30 days', 30, anchor, entryByDate, cadence),
        createRollingSummary('Last 90 days', 90, anchor, entryByDate, cadence),
        createRollingSummary('Last 365 days', 365, anchor, entryByDate, cadence),
    ];
}

function createRollingSummary(
    label: string,
    durationDays: number,
    anchor: moment.Moment,
    entryByDate: Map<string, JournalEntryRecord>,
    cadence: import('../cadence').JournalCadenceConfig,
): PeriodSummary {
    const start = anchor.clone().subtract(durationDays - 1, 'days');
    return createPeriodSummary(label, start, anchor.clone(), entryByDate, cadence);
}

function createPeriodSummary(
    label: string,
    start: moment.Moment,
    end: moment.Moment,
    entryByDate: Map<string, JournalEntryRecord>,
    cadence: import('../cadence').JournalCadenceConfig,
): PeriodSummary {
    const startDate = start.format('YYYY-MM-DD');
    const endDate = end.format('YYYY-MM-DD');
    if (!isCadenceTracked(cadence)) {
        return {
            label,
            startDate,
            endDate,
            completedDays: 0,
            totalDays: 0,
            completionRate: 0,
            tracked: false,
        };
    }

    const expectedDates = getExpectedDatesInRange(cadence, startDate, endDate);
    const completedDays = expectedDates.filter(date => entryByDate.has(date)).length;
    const totalDays = expectedDates.length;
    const completionRate = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

    return {
        label,
        startDate,
        endDate,
        completedDays,
        totalDays,
        completionRate,
        tracked: true,
    };
}

function buildInsights(entries: JournalEntryRecord[], anchorDate: string, cadence: import('../cadence').JournalCadenceConfig): ReviewInsights {
    const cadenceLabel = getCadenceLabel(cadence);
    const dateSet = new Set(entries.map(entry => entry.date));
    const firstEntryDate = entries[0]?.date ?? null;
    const cadenceStatus = getCadenceStatus(cadence, dateSet, anchorDate, firstEntryDate);

    if (entries.length === 0) {
        return {
            currentStreak: 0,
            longestStreak: 0,
            longestMissStretch: 0,
            totalEntries: 0,
            busiestWeekday: null,
            busiestMonth: null,
            cadenceLabel,
            expectedToday: cadenceStatus.expectedToday,
            outstandingMisses: cadenceStatus.outstandingMisses,
            nextExpectedDate: cadenceStatus.nextExpectedDate,
            isTracked: cadenceStatus.isTracked,
        };
    }

    const dates = entries.map(entry => entry.date);
    const currentStreak = getCurrentCadenceStreak(cadence, dateSet, anchorDate);
    const longestStreak = getLongestCadenceStreak(cadence, dateSet, dates);
    const longestMissStretch = getLongestMissStretch(cadence, dateSet, firstEntryDate, anchorDate);
    const busiestWeekday = getBusiestWeekday(entries);
    const busiestMonth = getBusiestMonth(entries);

    return {
        currentStreak,
        longestStreak,
        longestMissStretch,
        totalEntries: entries.length,
        busiestWeekday,
        busiestMonth,
        cadenceLabel,
        expectedToday: cadenceStatus.expectedToday,
        outstandingMisses: cadenceStatus.outstandingMisses,
        nextExpectedDate: cadenceStatus.nextExpectedDate,
        isTracked: cadenceStatus.isTracked,
    };
}

function buildRecentActivity(anchor: moment.Moment, entryByDate: Map<string, JournalEntryRecord>, cadence: import('../cadence').JournalCadenceConfig): ActivityCell[] {
    const cells: ActivityCell[] = [];
    const start = anchor.clone().subtract(34, 'days');
    let cursor = start.clone();

    while (cursor.isSameOrBefore(anchor, 'day')) {
        const date = cursor.format('YYYY-MM-DD');
        cells.push({
            date,
            hasEntry: entryByDate.has(date),
            isExpected: isExpectedOnDate(cadence, date),
        });
        cursor.add(1, 'day');
    }

    return cells;
}

function buildWeekdayDistribution(entries: JournalEntryRecord[]): DistributionDatum[] {
    const counts = new Map<number, number>();

    entries.forEach(entry => {
        const weekday = moment(entry.date, 'YYYY-MM-DD', true).day();
        counts.set(weekday, (counts.get(weekday) ?? 0) + 1);
    });

    return WEEKDAY_LABELS.map((label, index) => ({
        label: label.slice(0, 3),
        value: counts.get(index) ?? 0,
    }));
}

function buildMonthlyActivity(entries: JournalEntryRecord[], anchor: moment.Moment): DistributionDatum[] {
    const counts = new Map<string, number>();

    entries.forEach(entry => {
        const month = moment(entry.date, 'YYYY-MM-DD', true).format('YYYY-MM');
        counts.set(month, (counts.get(month) ?? 0) + 1);
    });

    const data: DistributionDatum[] = [];

    for (let index = 11; index >= 0; index -= 1) {
        const month = anchor.clone().subtract(index, 'months').format('YYYY-MM');
        data.push({
            label: anchor.clone().subtract(index, 'months').format('MMM'),
            value: counts.get(month) ?? 0,
        });
    }

    return data;
}

function getBusiestWeekday(entries: JournalEntryRecord[]): string | null {
    const weekdayCounts = new Map<number, number>();

    entries.forEach(entry => {
        const weekday = moment(entry.date, 'YYYY-MM-DD', true).day();
        weekdayCounts.set(weekday, (weekdayCounts.get(weekday) ?? 0) + 1);
    });

    const busiest = Array.from(weekdayCounts.entries())
        .sort((left, right) => right[1] - left[1] || left[0] - right[0])[0];

    return busiest ? WEEKDAY_LABELS[busiest[0]] : null;
}

function getBusiestMonth(entries: JournalEntryRecord[]): string | null {
    const monthCounts = new Map<string, number>();

    entries.forEach(entry => {
        const month = moment(entry.date, 'YYYY-MM-DD', true).format('YYYY-MM');
        monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
    });

    const busiest = Array.from(monthCounts.entries())
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0];

    return busiest ? busiest[0] : null;
}
