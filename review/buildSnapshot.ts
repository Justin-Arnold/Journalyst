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
    AnalyticsCallout,
    DistributionDatum,
    JournalAnalyticsSnapshot,
    JournalEntryRecord,
    JournalReviewSnapshot,
    LookbackResult,
    PeriodSummary,
    RankedPeriod,
    ReviewInsights,
    RollingComparison,
    SynthesisNotePreview,
    SynthesisPeriodType,
    YearActivityCell,
} from './types';

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface SnapshotContext {
    journal: TFolder;
    anchor: moment.Moment;
    anchorDate: string;
    entries: JournalEntryRecord[];
    entryByDate: Map<string, JournalEntryRecord>;
    dateSet: Set<string>;
    firstEntryDate: string | null;
    cadence: import('../cadence').JournalCadenceConfig;
    insights: ReviewInsights;
}

export function buildJournalReviewSnapshot(journal: TFolder, anchorDate: string, journalDateSettings: JournalDateSettings): JournalReviewSnapshot {
    const context = buildSnapshotContext(journal, anchorDate, journalDateSettings);

    return {
        journalPath: context.journal.path,
        journalName: context.journal.name,
        anchor: { date: context.anchorDate },
        lookbacks: buildLookbacks(context.anchor, context.entryByDate),
        calendarSummaries: buildCalendarSummaries(context.anchor, context.entryByDate, context.cadence),
        rollingSummaries: buildRollingSummaries(context.anchor, context.entryByDate, context.cadence),
        insights: context.insights,
        entryCount: context.entries.length,
        recentActivity: buildRecentActivity(context.anchor, context.entryByDate, context.cadence),
        reviewCallouts: buildReviewCallouts(context),
    };
}

export function buildJournalAnalyticsSnapshot(journal: TFolder, anchorDate: string, journalDateSettings: JournalDateSettings): JournalAnalyticsSnapshot {
    const context = buildSnapshotContext(journal, anchorDate, journalDateSettings);

    return {
        journalPath: context.journal.path,
        journalName: context.journal.name,
        anchor: { date: context.anchorDate },
        insights: context.insights,
        yearActivity: buildYearActivity(context.anchor, context.entryByDate, context.cadence),
        weekdayDistribution: buildWeekdayDistribution(context.entries),
        monthlyActivity: buildMonthlyActivity(context.entries, context.anchor),
        rollingComparisons: buildRollingComparisons(context.anchor, context.entryByDate, context.cadence),
        rankedPeriods: buildRankedPeriods(context.anchor, context.entryByDate, context.cadence),
        callouts: buildAnalyticsCallouts(context),
    };
}

export function buildSynthesisNotePreview(
    journal: TFolder,
    anchorDate: string,
    journalDateSettings: JournalDateSettings,
    periodType: SynthesisPeriodType,
): SynthesisNotePreview {
    const context = buildSnapshotContext(journal, anchorDate, journalDateSettings);
    const period = getSynthesisPeriod(context.anchor, periodType);
    const summary = createPeriodSummary(period.label, period.start, period.end, context.entryByDate, context.cadence);
    const notableEntries = context.entries
        .filter(entry => entry.date >= summary.startDate && entry.date <= summary.endDate)
        .slice(-5)
        .reverse();
    const strongestPatterns = buildStrongestPatterns(context, summary);
    const weakestPatterns = buildWeakestPatterns(context, summary);
    const reflectionPrompts = buildReflectionPrompts(periodType, context, summary);
    const title = buildSynthesisTitle(periodType, context.anchor);
    const fileName = buildSynthesisFileName(periodType, context.anchor);
    const body = buildSynthesisBody(title, summary, notableEntries, strongestPatterns, weakestPatterns, reflectionPrompts);

    return {
        periodType,
        title,
        fileName,
        startDate: summary.startDate,
        endDate: summary.endDate,
        summary,
        notableEntries,
        strongestPatterns,
        weakestPatterns,
        reflectionPrompts,
        payload: {
            title,
            fileName,
            startDate: summary.startDate,
            endDate: summary.endDate,
            body,
        },
    };
}

function buildSnapshotContext(journal: TFolder, anchorDate: string, journalDateSettings: JournalDateSettings): SnapshotContext {
    const entries = getJournalEntries(journal, journalDateSettings);
    const entryByDate = new Map(entries.map(entry => [entry.date, entry]));
    const cadence = normalizeJournalCadence(
        (journalDateSettings as JournalDateSettings & { journalCadences?: Record<string, import('../cadence').JournalCadenceConfig> })
            .journalCadences?.[journal.path]
    );
    const anchor = moment(anchorDate, 'YYYY-MM-DD', true);
    const normalizedAnchor = anchor.isValid() ? anchor : moment();
    const normalizedAnchorDate = normalizedAnchor.format('YYYY-MM-DD');
    const dateSet = new Set(entries.map(entry => entry.date));
    const firstEntryDate = entries[0]?.date ?? null;
    const insights = buildInsights(entries, normalizedAnchorDate, cadence);

    return {
        journal,
        anchor: normalizedAnchor,
        anchorDate: normalizedAnchorDate,
        entries,
        entryByDate,
        dateSet,
        firstEntryDate,
        cadence,
        insights,
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

function buildYearActivity(anchor: moment.Moment, entryByDate: Map<string, JournalEntryRecord>, cadence: import('../cadence').JournalCadenceConfig): YearActivityCell[] {
    const start = anchor.clone().startOf('year');
    const end = anchor.clone().endOf('year');
    const cells: YearActivityCell[] = [];
    let cursor = start.clone();

    while (cursor.isSameOrBefore(end, 'day')) {
        const date = cursor.format('YYYY-MM-DD');
        cells.push({
            date,
            hasEntry: entryByDate.has(date),
            isExpected: isExpectedOnDate(cadence, date),
            isFuture: cursor.isAfter(anchor, 'day'),
            monthLabel: cursor.format('MMM'),
            dayLabel: cursor.format('D'),
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

function buildRollingComparisons(anchor: moment.Moment, entryByDate: Map<string, JournalEntryRecord>, cadence: import('../cadence').JournalCadenceConfig): RollingComparison[] {
    return [
        createRollingComparison('30-day momentum', 30, anchor, entryByDate, cadence),
        createRollingComparison('90-day momentum', 90, anchor, entryByDate, cadence),
    ];
}

function createRollingComparison(
    label: string,
    durationDays: number,
    anchor: moment.Moment,
    entryByDate: Map<string, JournalEntryRecord>,
    cadence: import('../cadence').JournalCadenceConfig,
): RollingComparison {
    const current = createRollingSummary(`Current ${durationDays} days`, durationDays, anchor, entryByDate, cadence);
    const previousEnd = anchor.clone().subtract(durationDays, 'days');
    const previous = createRollingSummary(`Previous ${durationDays} days`, durationDays, previousEnd, entryByDate, cadence);

    return {
        label,
        current,
        previous,
        rateDelta: current.completionRate - previous.completionRate,
    };
}

function buildRankedPeriods(anchor: moment.Moment, entryByDate: Map<string, JournalEntryRecord>, cadence: import('../cadence').JournalCadenceConfig) {
    if (!isCadenceTracked(cadence)) {
        return { best: null, worst: null };
    }

    const periods: RankedPeriod[] = [];
    for (let index = 5; index >= 0; index -= 1) {
        const month = anchor.clone().subtract(index, 'months');
        const summary = createPeriodSummary(month.format('MMM YYYY'), month.clone().startOf('month'), month.clone().endOf('month'), entryByDate, cadence);
        if (summary.totalDays > 0) {
            periods.push(summary);
        }
    }

    const sorted = [...periods].sort((left, right) => right.completionRate - left.completionRate || left.startDate.localeCompare(right.startDate));

    return {
        best: sorted[0] ?? null,
        worst: sorted[sorted.length - 1] ?? null,
    };
}

function buildReviewCallouts(context: SnapshotContext): AnalyticsCallout[] {
    const callouts: AnalyticsCallout[] = [];

    if (context.insights.longestStreak > 0) {
        callouts.push({
            title: 'Best streak',
            body: `Your longest consistency run is ${context.insights.longestStreak} expected entries.`,
        });
    }

    if (context.insights.isTracked && context.insights.outstandingMisses > 0) {
        callouts.push({
            title: 'Hardest stretch',
            body: `You have ${context.insights.outstandingMisses} outstanding missed entries right now.`,
        });
    }

    if (context.insights.busiestWeekday) {
        callouts.push({
            title: 'Natural rhythm',
            body: `You tend to show up most on ${context.insights.busiestWeekday}s.`,
        });
    }

    return callouts.slice(0, 3);
}

function buildAnalyticsCallouts(context: SnapshotContext): AnalyticsCallout[] {
    const comparisons = buildRollingComparisons(context.anchor, context.entryByDate, context.cadence);
    const ranked = buildRankedPeriods(context.anchor, context.entryByDate, context.cadence);
    const callouts: AnalyticsCallout[] = [];

    comparisons.forEach(comparison => {
        if (!comparison.current.tracked) {
            return;
        }

        if (comparison.rateDelta > 0) {
            callouts.push({
                title: comparison.label,
                body: `You are up ${comparison.rateDelta}% compared with the prior period.`,
            });
        } else if (comparison.rateDelta < 0) {
            callouts.push({
                title: comparison.label,
                body: `You are down ${Math.abs(comparison.rateDelta)}% compared with the prior period.`,
            });
        }
    });

    if (ranked.best) {
        callouts.push({
            title: 'Best recent period',
            body: `${ranked.best.label} was your strongest recent stretch at ${ranked.best.completionRate}% completion.`,
        });
    }

    if (ranked.worst && ranked.worst !== ranked.best) {
        callouts.push({
            title: 'Weakest recent period',
            body: `${ranked.worst.label} was your softest recent stretch at ${ranked.worst.completionRate}% completion.`,
        });
    }

    if (context.insights.busiestWeekday) {
        callouts.push({
            title: 'Weekly bias',
            body: `You tend to write most on ${context.insights.busiestWeekday}s.`,
        });
    }

    return callouts.slice(0, 4);
}

function buildStrongestPatterns(context: SnapshotContext, summary: PeriodSummary) {
    const patterns: string[] = [];

    if (summary.tracked) {
        patterns.push(`${summary.completionRate}% of expected entries were completed during this period.`);
    }

    if (context.insights.busiestWeekday) {
        patterns.push(`${context.insights.busiestWeekday}s remain your strongest journaling day.`);
    }

    if (context.insights.longestStreak > 0) {
        patterns.push(`Your best consistency run so far is ${context.insights.longestStreak} expected entries.`);
    }

    return patterns.slice(0, 3);
}

function buildWeakestPatterns(context: SnapshotContext, summary: PeriodSummary) {
    const patterns: string[] = [];

    if (summary.tracked && summary.completionRate < 50) {
        patterns.push(`This period fell below the halfway mark for expected entries.`);
    }

    if (context.insights.isTracked && context.insights.longestMissStretch > 0) {
        patterns.push(`Your longest missed stretch is ${context.insights.longestMissStretch} expected entries.`);
    }

    if (context.insights.outstandingMisses > 0) {
        patterns.push(`You currently have ${context.insights.outstandingMisses} outstanding missed entries.`);
    }

    return patterns.slice(0, 3);
}

function buildReflectionPrompts(periodType: SynthesisPeriodType, context: SnapshotContext, summary: PeriodSummary) {
    const prompts = [
        `What mattered most during this ${periodType === 'weekly' ? 'week' : periodType === 'monthly' ? 'month' : 'quarter'}?`,
        summary.tracked
            ? `What helped you meet ${summary.completionRate}% of your expected journaling rhythm, and what got in the way?`
            : 'What kind of journaling rhythm felt natural during this period?',
        context.insights.busiestWeekday
            ? `Why do you think ${context.insights.busiestWeekday}s have been your strongest day lately?`
            : 'Which situations made it easiest to show up and write?',
    ];

    return prompts;
}

function buildSynthesisTitle(periodType: SynthesisPeriodType, anchor: moment.Moment) {
    if (periodType === 'weekly') {
        return `Weekly Review ${anchor.format('YYYY [Week] WW')}`;
    }

    if (periodType === 'monthly') {
        return `Monthly Reflection ${anchor.format('YYYY-MM')}`;
    }

    return `Quarter Summary ${anchor.format('YYYY [Q]Q')}`;
}

function buildSynthesisFileName(periodType: SynthesisPeriodType, anchor: moment.Moment) {
    if (periodType === 'weekly') {
        return `weekly-review-${anchor.format('YYYY-[W]WW')}.md`;
    }

    if (periodType === 'monthly') {
        return `monthly-reflection-${anchor.format('YYYY-MM')}.md`;
    }

    return `quarter-summary-${anchor.format('YYYY-[Q]Q')}.md`;
}

function buildSynthesisBody(
    title: string,
    summary: PeriodSummary,
    notableEntries: JournalEntryRecord[],
    strongestPatterns: string[],
    weakestPatterns: string[],
    reflectionPrompts: string[],
) {
    const entryLines = notableEntries.length > 0
        ? notableEntries.map(entry => `- [[${entry.filePath.replace(/\.md$/i, '')}|${entry.displayLabel}]]`).join('\n')
        : '- No journal entries in this period.';
    const strongestLines = strongestPatterns.length > 0
        ? strongestPatterns.map(pattern => `- ${pattern}`).join('\n')
        : '- Nothing notable yet.';
    const weakestLines = weakestPatterns.length > 0
        ? weakestPatterns.map(pattern => `- ${pattern}`).join('\n')
        : '- No clear weak spots yet.';
    const promptLines = reflectionPrompts.map(prompt => `- ${prompt}`).join('\n');
    const summaryLine = summary.tracked
        ? `${summary.completedDays}/${summary.totalDays} expected entries (${summary.completionRate}%)`
        : 'Ad hoc journal; completion is not scored.';

    return [
        `# ${title}`,
        '',
        '## Period',
        `- ${summary.startDate} to ${summary.endDate}`,
        '',
        '## Summary',
        `- ${summaryLine}`,
        '',
        '## Notable Entries',
        entryLines,
        '',
        '## Strongest Patterns',
        strongestLines,
        '',
        '## Weakest Patterns',
        weakestLines,
        '',
        '## Reflection',
        promptLines,
        '',
    ].join('\n');
}

function getSynthesisPeriod(anchor: moment.Moment, periodType: SynthesisPeriodType) {
    if (periodType === 'weekly') {
        return {
            label: 'This week',
            start: anchor.clone().startOf('week'),
            end: anchor.clone(),
        };
    }

    if (periodType === 'monthly') {
        return {
            label: 'This month',
            start: anchor.clone().startOf('month'),
            end: anchor.clone(),
        };
    }

    return {
        label: 'This quarter',
        start: anchor.clone().startOf('quarter'),
        end: anchor.clone(),
    };
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
