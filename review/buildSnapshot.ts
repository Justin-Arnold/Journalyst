import { TFile, TFolder, moment } from 'obsidian';
import {
    JournalEntryRecord,
    JournalReviewSnapshot,
    LookbackResult,
    PeriodSummary,
    ReviewInsights,
} from './types';

const DATE_FILE_PATTERN = /^\d{4}-\d{2}-\d{2}\.md$/;
const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function buildJournalReviewSnapshot(journal: TFolder, anchorDate: string): JournalReviewSnapshot {
    const entries = getJournalEntries(journal);
    const entryByDate = new Map(entries.map(entry => [entry.date, entry]));
    const anchor = moment(anchorDate, 'YYYY-MM-DD', true);
    const normalizedAnchor = anchor.isValid() ? anchor : moment();
    const normalizedAnchorDate = normalizedAnchor.format('YYYY-MM-DD');

    return {
        journalPath: journal.path,
        journalName: journal.name,
        anchor: { date: normalizedAnchorDate },
        lookbacks: buildLookbacks(normalizedAnchor, entryByDate),
        calendarSummaries: buildCalendarSummaries(normalizedAnchor, entryByDate),
        rollingSummaries: buildRollingSummaries(normalizedAnchor, entryByDate),
        insights: buildInsights(entries, normalizedAnchorDate),
        entryCount: entries.length,
    };
}

function getJournalEntries(journal: TFolder): JournalEntryRecord[] {
    return journal.children
        .filter((child): child is TFile => child instanceof TFile)
        .filter(file => DATE_FILE_PATTERN.test(file.name))
        .map(file => {
            const date = file.basename;
            return {
                journalPath: journal.path,
                filePath: file.path,
                date,
                displayLabel: date,
            };
        })
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

function buildCalendarSummaries(anchor: moment.Moment, entryByDate: Map<string, JournalEntryRecord>): PeriodSummary[] {
    return [
        createPeriodSummary('This week', anchor.clone().startOf('week'), anchor.clone(), entryByDate),
        createPeriodSummary('This month', anchor.clone().startOf('month'), anchor.clone(), entryByDate),
        createPeriodSummary('This quarter', anchor.clone().startOf('quarter'), anchor.clone(), entryByDate),
        createPeriodSummary('This year', anchor.clone().startOf('year'), anchor.clone(), entryByDate),
    ];
}

function buildRollingSummaries(anchor: moment.Moment, entryByDate: Map<string, JournalEntryRecord>): PeriodSummary[] {
    return [
        createRollingSummary('Last 7 days', 7, anchor, entryByDate),
        createRollingSummary('Last 30 days', 30, anchor, entryByDate),
        createRollingSummary('Last 90 days', 90, anchor, entryByDate),
        createRollingSummary('Last 365 days', 365, anchor, entryByDate),
    ];
}

function createRollingSummary(
    label: string,
    durationDays: number,
    anchor: moment.Moment,
    entryByDate: Map<string, JournalEntryRecord>,
): PeriodSummary {
    const start = anchor.clone().subtract(durationDays - 1, 'days');
    return createPeriodSummary(label, start, anchor.clone(), entryByDate);
}

function createPeriodSummary(
    label: string,
    start: moment.Moment,
    end: moment.Moment,
    entryByDate: Map<string, JournalEntryRecord>,
): PeriodSummary {
    const startDate = start.format('YYYY-MM-DD');
    const endDate = end.format('YYYY-MM-DD');
    let completedDays = 0;
    let current = start.clone();

    while (current.isSameOrBefore(end, 'day')) {
        if (entryByDate.has(current.format('YYYY-MM-DD'))) {
            completedDays += 1;
        }

        current.add(1, 'day');
    }

    const totalDays = end.diff(start, 'days') + 1;
    const completionRate = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

    return {
        label,
        startDate,
        endDate,
        completedDays,
        totalDays,
        completionRate,
    };
}

function buildInsights(entries: JournalEntryRecord[], anchorDate: string): ReviewInsights {
    if (entries.length === 0) {
        return {
            currentStreak: 0,
            longestStreak: 0,
            longestGapDays: 0,
            totalEntries: 0,
            busiestWeekday: null,
            busiestMonth: null,
        };
    }

    const dates = entries.map(entry => entry.date);
    const dateSet = new Set(dates);
    const currentStreak = getCurrentStreak(dateSet, anchorDate);
    const longestStreak = getLongestStreak(dates);
    const longestGapDays = getLongestGapDays(dates);
    const busiestWeekday = getBusiestWeekday(entries);
    const busiestMonth = getBusiestMonth(entries);

    return {
        currentStreak,
        longestStreak,
        longestGapDays,
        totalEntries: entries.length,
        busiestWeekday,
        busiestMonth,
    };
}

function getCurrentStreak(dateSet: Set<string>, anchorDate: string): number {
    let streak = 0;
    let cursor = moment(anchorDate, 'YYYY-MM-DD', true);

    while (dateSet.has(cursor.format('YYYY-MM-DD'))) {
        streak += 1;
        cursor = cursor.subtract(1, 'day');
    }

    return streak;
}

function getLongestStreak(dates: string[]): number {
    let longest = 0;
    let current = 0;
    let previous: moment.Moment | null = null;

    dates.forEach(date => {
        const currentDate = moment(date, 'YYYY-MM-DD', true);

        if (!previous || currentDate.diff(previous, 'days') !== 1) {
            current = 1;
        } else {
            current += 1;
        }

        if (current > longest) {
            longest = current;
        }

        previous = currentDate;
    });

    return longest;
}

function getLongestGapDays(dates: string[]): number {
    if (dates.length < 2) {
        return 0;
    }

    let longestGap = 0;

    for (let index = 1; index < dates.length; index += 1) {
        const previous = moment(dates[index - 1], 'YYYY-MM-DD', true);
        const current = moment(dates[index], 'YYYY-MM-DD', true);
        const gapDays = Math.max(0, current.diff(previous, 'days') - 1);

        if (gapDays > longestGap) {
            longestGap = gapDays;
        }
    }

    return longestGap;
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
