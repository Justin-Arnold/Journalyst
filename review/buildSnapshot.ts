import { TFile, TFolder } from 'obsidian';
import moment from 'moment';
import {
    createJournalCadenceSchedule,
    getCadenceForDate,
    getCadenceLabel,
    getCadenceStatus,
    getCadenceTimelineStartDate,
    getCurrentCadenceStreak,
    getExpectedDatesInRange,
    getLongestCadenceStreak,
    getLongestMissStretch,
    hasTrackedCadenceInRange,
    isExpectedOnDate,
    normalizeJournalCadence,
    normalizeJournalCadenceTimeline,
    type JournalCadenceSource,
} from '../cadence';
import { type JournalDateSettings, parseJournalDateFromFile } from '../journalNaming';
import {
    type AnalyticsChartSeries,
    type AnalyticsInsight,
    type AnalyticsPerformanceMetric,
    type AnalyticsRankedWeek,
    type AnalyticsSummaryMetric,
    type JournalAnalyticsSnapshot,
    type JournalEntryRecord,
    type JournalReviewSnapshot,
    type LookbackResult,
    type PeriodSummary,
    type ReviewActivityCell,
    type ReviewInsights,
    type ReviewTodayAction,
    type SynthesisNotePreview,
    type SynthesisPeriodType,
    type YearActivityCell,
} from './types';

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface SnapshotContext {
    journal: TFolder;
    anchor: moment.Moment;
    anchorDate: string;
    entries: JournalEntryRecord[];
    completedEntries: JournalEntryRecord[];
    entryByDate: Map<string, JournalEntryRecord>;
    completedEntryByDate: Map<string, JournalEntryRecord>;
    cadence: JournalCadenceSource;
    trackingStartDate: string;
    insights: ReviewInsights;
}

interface AnalyticsContext extends SnapshotContext {
    effectiveAnchor: moment.Moment;
    effectiveAnchorDate: string;
    entriesThroughAnchor: JournalEntryRecord[];
    completedEntriesThroughAnchor: JournalEntryRecord[];
}

export interface SnapshotBuildOptions {
    isEntryComplete?: (file: TFile) => boolean;
    promptSourceLabel?: string;
    templateLabel?: string;
}

export function buildJournalReviewSnapshot(
    journal: TFolder,
    anchorDate: string,
    journalDateSettings: JournalDateSettings,
    options: SnapshotBuildOptions = {},
): JournalReviewSnapshot {
    const context = buildSnapshotContext(journal, anchorDate, journalDateSettings, options);
    const calendarSummaries = buildCalendarSummaries(
        context.anchor,
        context.completedEntryByDate,
        context.cadence,
    );

    return {
        journalPath: context.journal.path,
        journalName: context.journal.name,
        anchor: { date: context.anchorDate },
        lookbacks: buildLookbacks(context.anchor, context.entryByDate),
        calendarSummaries,
        currentMonthSummary: calendarSummaries[1]!,
        rollingSummaries: buildRollingSummaries(context.anchor, context.completedEntryByDate, context.cadence),
        insights: context.insights,
        entryCount: context.entries.length,
        recentActivity: buildRecentActivity(context),
        todayAction: buildTodayAction(context),
        configurationInsights: {
            promptSourceLabel: options.promptSourceLabel ?? 'Off',
            templateLabel: options.templateLabel ?? 'Journalyst default',
        },
    };
}

export function buildJournalAnalyticsSnapshot(
    journal: TFolder,
    anchorDate: string,
    journalDateSettings: JournalDateSettings,
    options: SnapshotBuildOptions = {},
): JournalAnalyticsSnapshot {
    const context = buildSnapshotContext(journal, anchorDate, journalDateSettings, options);
    const effectiveAnchor = moment.min(context.anchor, moment().startOf('day'));
    const effectiveAnchorDate = effectiveAnchor.format('YYYY-MM-DD');
    const isAdHoc = !hasTrackedCadenceInRange(
        context.cadence,
        context.trackingStartDate,
        effectiveAnchorDate,
    );
    const analyticsContext: AnalyticsContext = {
        ...context,
        effectiveAnchor,
        effectiveAnchorDate,
        entriesThroughAnchor: context.entries.filter(entry => entry.date <= effectiveAnchorDate),
        completedEntriesThroughAnchor: context.completedEntries.filter(entry => entry.date <= effectiveAnchorDate),
    };
    const summaryMetrics = buildAnalyticsSummaryMetrics(analyticsContext, isAdHoc);
    const weekdayRhythm = buildWeekdayRhythm(analyticsContext, isAdHoc);
    const monthlyVolume = buildMonthlyVolume(analyticsContext);

    return {
        journalPath: context.journal.path,
        journalName: context.journal.name,
        anchor: { date: context.anchorDate },
        effectiveAnchorDate,
        summaryMetrics,
        patternInsights: buildAnalyticsInsights(analyticsContext, weekdayRhythm, isAdHoc),
        weekdayRhythm,
        monthlyVolume,
        yearActivity: buildYearActivity(analyticsContext),
        rankedWeeks: buildRankedWeeks(analyticsContext),
        cadencePerformance: buildCadencePerformance(analyticsContext, isAdHoc),
        cadencePerformanceDescription: isAdHoc
            ? 'Entry completion over the last 90 days. Ad-hoc journals do not have expected-day scores.'
            : 'Completion across the latest expected dates and the entries written during the same span.',
        isAdHoc,
    };
}

export function buildSynthesisNotePreview(
    journal: TFolder,
    anchorDate: string,
    journalDateSettings: JournalDateSettings,
    periodType: SynthesisPeriodType,
    options: SnapshotBuildOptions = {},
): SynthesisNotePreview {
    const context = buildSnapshotContext(journal, anchorDate, journalDateSettings, options);
    const period = getSynthesisPeriod(context.anchor, periodType);
    const summary = createPeriodSummary(period.label, period.start, period.end, context.completedEntryByDate, context.cadence);
    const notableEntries = context.completedEntries
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

function buildSnapshotContext(
    journal: TFolder,
    anchorDate: string,
    journalDateSettings: JournalDateSettings,
    options: SnapshotBuildOptions,
): SnapshotContext {
    const entries = getJournalEntries(journal, journalDateSettings, options);
    const completedEntries = entries.filter(entry => entry.isComplete);
    const entryByDate = new Map(entries.map(entry => [entry.date, entry]));
    const completedEntryByDate = new Map(completedEntries.map(entry => [entry.date, entry]));
    const anchor = moment(anchorDate, 'YYYY-MM-DD', true);
    const normalizedAnchor = anchor.isValid() ? anchor : moment();
    const normalizedAnchorDate = normalizedAnchor.format('YYYY-MM-DD');
    const cadenceSettings = journalDateSettings as JournalDateSettings & {
        journalCadenceRevisions?: Record<string, import('../cadence').JournalCadenceRevision[]>;
        journalSchedulePauses?: Record<string, import('../cadence').JournalSchedulePause[]>;
        journalCadences?: Record<string, import('../cadence').JournalCadenceConfig>;
    };
    const cadenceTimeline = normalizeJournalCadenceTimeline(cadenceSettings.journalCadenceRevisions?.[journal.path]);
    const cadence: JournalCadenceSource = createJournalCadenceSchedule(
        cadenceTimeline.length > 0
            ? cadenceTimeline
            : [{
                effectiveFrom: entries[0]?.date ?? normalizedAnchorDate,
                cadence: normalizeJournalCadence(cadenceSettings.journalCadences?.[journal.path]),
            }],
        cadenceSettings.journalSchedulePauses?.[journal.path],
    );
    const trackingStartDate = getCadenceTimelineStartDate(cadence)
        ?? entries[0]?.date
        ?? normalizedAnchorDate;
    const insights = buildInsights(entries, completedEntries, normalizedAnchorDate, cadence);

    return {
        journal,
        anchor: normalizedAnchor,
        anchorDate: normalizedAnchorDate,
        entries,
        completedEntries,
        entryByDate,
        completedEntryByDate,
        cadence,
        trackingStartDate,
        insights,
    };
}

function getJournalEntries(
    journal: TFolder,
    journalDateSettings: JournalDateSettings,
    options: SnapshotBuildOptions,
): JournalEntryRecord[] {
    return journal.children
        .map(file => {
            if (!(file instanceof TFile)) {
                return null;
            }

            const date = parseJournalDateFromFile(file, journalDateSettings);

            if (!date) {
                return null;
            }

            return {
                journalPath: journal.path,
                filePath: file.path,
                date,
                displayLabel: date,
                isComplete: options.isEntryComplete?.(file) ?? true,
            };
        })
        .filter((entry): entry is JournalEntryRecord => entry !== null)
        .sort((left, right) => left.date.localeCompare(right.date));
}

function buildLookbacks(anchor: moment.Moment, entryByDate: Map<string, JournalEntryRecord>): LookbackResult[] {
    return [
        { label: 'Yesterday', targetDate: anchor.clone().subtract(1, 'day').format('YYYY-MM-DD') },
        { label: '1 week ago', targetDate: anchor.clone().subtract(1, 'week').format('YYYY-MM-DD') },
        { label: '1 month ago', targetDate: anchor.clone().subtract(1, 'month').format('YYYY-MM-DD') },
        { label: '1 year ago', targetDate: anchor.clone().subtract(1, 'year').format('YYYY-MM-DD') },
    ].map(lookback => ({
        ...lookback,
        entry: entryByDate.get(lookback.targetDate) ?? null,
    }));
}

function buildCalendarSummaries(anchor: moment.Moment, entryByDate: Map<string, JournalEntryRecord>, cadence: JournalCadenceSource): PeriodSummary[] {
    return [
        createPeriodSummary('This week', anchor.clone().startOf('week'), anchor.clone(), entryByDate, cadence),
        createPeriodSummary('This month', anchor.clone().startOf('month'), anchor.clone(), entryByDate, cadence),
        createPeriodSummary('This quarter', anchor.clone().startOf('quarter'), anchor.clone(), entryByDate, cadence),
        createPeriodSummary('This year', anchor.clone().startOf('year'), anchor.clone(), entryByDate, cadence),
    ];
}

function buildRollingSummaries(anchor: moment.Moment, entryByDate: Map<string, JournalEntryRecord>, cadence: JournalCadenceSource): PeriodSummary[] {
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
    cadence: JournalCadenceSource,
): PeriodSummary {
    const start = anchor.clone().subtract(durationDays - 1, 'days');
    return createPeriodSummary(label, start, anchor.clone(), entryByDate, cadence);
}

function createPeriodSummary(
    label: string,
    start: moment.Moment,
    end: moment.Moment,
    entryByDate: Map<string, JournalEntryRecord>,
    cadence: JournalCadenceSource,
): PeriodSummary {
    const startDate = start.format('YYYY-MM-DD');
    const endDate = end.format('YYYY-MM-DD');
    if (!hasTrackedCadenceInRange(cadence, startDate, endDate)) {
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

function buildInsights(
    entries: JournalEntryRecord[],
    completedEntries: JournalEntryRecord[],
    anchorDate: string,
    cadence: JournalCadenceSource,
): ReviewInsights {
    const activeCadence = getCadenceForDate(cadence, anchorDate);
    const cadenceLabel = activeCadence ? getCadenceLabel(activeCadence) : 'Not scheduled yet';
    const dateSet = new Set(completedEntries.map(entry => entry.date));
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

    const dates = completedEntries.map(entry => entry.date);
    const currentStreak = getCurrentCadenceStreak(cadence, dateSet, anchorDate);
    const longestStreak = getLongestCadenceStreak(cadence, dateSet, dates);
    const longestMissStretch = getLongestMissStretch(cadence, dateSet, firstEntryDate, anchorDate);
    const busiestWeekday = getBusiestWeekday(completedEntries);
    const busiestMonth = getBusiestMonth(completedEntries);

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

function buildRecentActivity(context: SnapshotContext): ReviewActivityCell[] {
    const cells: ReviewActivityCell[] = [];
    const start = context.anchor.clone().subtract(83, 'days');
    const todayDate = moment().format('YYYY-MM-DD');
    let cursor = start.clone();

    while (cursor.isSameOrBefore(context.anchor, 'day')) {
        const date = cursor.format('YYYY-MM-DD');
        const entry = context.entryByDate.get(date) ?? null;
        const isExpected = isExpectedOnDate(context.cadence, date);
        const state = entry
            ? entry.isComplete ? 'complete' : 'draft'
            : date > todayDate ? 'future'
                : date < context.trackingStartDate || !isExpected ? 'skipped'
                    : date === todayDate ? 'due'
                        : 'missing-expected';

        cells.push({
            date,
            hasEntry: !!entry,
            isComplete: entry?.isComplete ?? false,
            isExpected,
            filePath: entry?.filePath ?? null,
            isAnchor: date === context.anchorDate,
            state,
        });
        cursor.add(1, 'day');
    }

    return cells;
}

function buildTodayAction(context: SnapshotContext): ReviewTodayAction {
    const date = moment().format('YYYY-MM-DD');
    const entry = context.entryByDate.get(date);

    if (entry?.isComplete) {
        return { kind: 'open', label: 'Open today', date };
    }

    if (entry) {
        return { kind: 'continue', label: 'Continue today', date };
    }

    if (isExpectedOnDate(context.cadence, date)) {
        return { kind: 'write', label: 'Write today', date };
    }

    return { kind: 'go-to', label: 'Go to today', date };
}

function buildAnalyticsSummaryMetrics(context: AnalyticsContext, isAdHoc: boolean): AnalyticsSummaryMetric[] {
    if (isAdHoc) {
        return [
            buildEntryVolumeMetric(context, '30-day-volume', 'Entries in 30 days', 30),
            buildEntryVolumeMetric(context, '90-day-volume', 'Entries in 90 days', 90),
            {
                id: 'lifetime-volume',
                label: 'Lifetime entries',
                value: `${context.entriesThroughAnchor.length}`,
                supportingText: `${context.completedEntriesThroughAnchor.length} finished`,
                comparisonText: null,
                comparisonTone: 'neutral',
            },
        ];
    }

    const thirtyDayComparison = createAnalyticsPeriodComparison(30, context);
    const ninetyDayComparison = createAnalyticsPeriodComparison(90, context);
    const currentStreakWindow = getAverageStreak(
        context.cadence,
        context.completedEntryByDate,
        context.effectiveAnchor.clone().subtract(89, 'days'),
        context.effectiveAnchor,
    );
    const previousStreakWindow = getAverageStreak(
        context.cadence,
        context.completedEntryByDate,
        context.effectiveAnchor.clone().subtract(179, 'days'),
        context.effectiveAnchor.clone().subtract(90, 'days'),
    );
    const averageDelta = currentStreakWindow.average - previousStreakWindow.average;

    return [
        buildCompletionMetric('30-day-completion', '30-day completion', thirtyDayComparison),
        buildCompletionMetric('90-day-completion', '90-day completion', ninetyDayComparison),
        {
            id: 'average-streak',
            label: 'Average streak',
            value: currentStreakWindow.expectedCount > 0
                ? `${currentStreakWindow.average.toFixed(1)} days`
                : 'Not scored',
            supportingText: currentStreakWindow.runCount > 0
                ? `${currentStreakWindow.runCount} completed run${currentStreakWindow.runCount === 1 ? '' : 's'} in 90 days`
                : 'No completed runs in 90 days',
            comparisonText: currentStreakWindow.expectedCount > 0 && previousStreakWindow.expectedCount > 0
                ? formatDecimalComparison(averageDelta)
                : null,
            comparisonTone: getComparisonTone(Math.abs(averageDelta) < 0.05 ? 0 : averageDelta),
        },
    ];
}

function buildEntryVolumeMetric(
    context: AnalyticsContext,
    id: string,
    label: string,
    durationDays: number,
): AnalyticsSummaryMetric {
    const currentStart = context.effectiveAnchor.clone().subtract(durationDays - 1, 'days');
    const previousEnd = currentStart.clone().subtract(1, 'day');
    const previousStart = previousEnd.clone().subtract(durationDays - 1, 'days');
    const currentEntries = getEntriesInRange(context.entriesThroughAnchor, currentStart, context.effectiveAnchor);
    const previousEntries = getEntriesInRange(context.entriesThroughAnchor, previousStart, previousEnd);
    const finishedCount = currentEntries.filter(entry => entry.isComplete).length;
    const delta = currentEntries.length - previousEntries.length;

    return {
        id,
        label,
        value: `${currentEntries.length}`,
        supportingText: `${finishedCount} finished`,
        comparisonText: formatCountComparison(delta),
        comparisonTone: getComparisonTone(delta),
    };
}

interface AnalyticsPeriodComparison {
    current: PeriodSummary;
    previous: PeriodSummary;
    delta: number;
}

function createAnalyticsPeriodComparison(durationDays: number, context: AnalyticsContext): AnalyticsPeriodComparison {
    const current = createRollingSummary(
        `Last ${durationDays} days`,
        durationDays,
        context.effectiveAnchor,
        context.completedEntryByDate,
        context.cadence,
    );
    const previous = createRollingSummary(
        `Previous ${durationDays} days`,
        durationDays,
        context.effectiveAnchor.clone().subtract(durationDays, 'days'),
        context.completedEntryByDate,
        context.cadence,
    );

    return {
        current,
        previous,
        delta: current.completionRate - previous.completionRate,
    };
}

function buildCompletionMetric(
    id: string,
    label: string,
    comparison: AnalyticsPeriodComparison,
): AnalyticsSummaryMetric {
    const scored = comparison.current.totalDays > 0;
    const comparable = scored && comparison.previous.totalDays > 0;

    return {
        id,
        label,
        value: scored ? `${comparison.current.completionRate}%` : 'Not scored',
        supportingText: scored
            ? `${comparison.current.completedDays} of ${comparison.current.totalDays} expected`
            : 'No expected days in this window',
        comparisonText: comparable ? formatPointComparison(comparison.delta) : null,
        comparisonTone: getComparisonTone(comparison.delta),
    };
}

function getAverageStreak(
    cadence: JournalCadenceSource,
    entryByDate: Map<string, JournalEntryRecord>,
    start: moment.Moment,
    end: moment.Moment,
) {
    const expectedDates = getExpectedDatesInRange(
        cadence,
        start.format('YYYY-MM-DD'),
        end.format('YYYY-MM-DD'),
    );
    const runs: number[] = [];
    let currentRun = 0;

    expectedDates.forEach(date => {
        if (entryByDate.has(date)) {
            currentRun += 1;
            return;
        }

        if (currentRun > 0) {
            runs.push(currentRun);
            currentRun = 0;
        }
    });

    if (currentRun > 0) {
        runs.push(currentRun);
    }

    return {
        average: runs.length > 0 ? runs.reduce((sum, run) => sum + run, 0) / runs.length : 0,
        runCount: runs.length,
        expectedCount: expectedDates.length,
    };
}

function buildWeekdayRhythm(context: AnalyticsContext, isAdHoc: boolean): AnalyticsChartSeries {
    const start = context.effectiveAnchor.clone().subtract(83, 'days');
    const entries = getEntriesInRange(context.entriesThroughAnchor, start, context.effectiveAnchor);
    const completedEntries = entries.filter(entry => entry.isComplete);

    if (isAdHoc) {
        const counts = new Map<number, { total: number; completed: number }>();
        entries.forEach(entry => {
            const weekday = moment(entry.date, 'YYYY-MM-DD', true).day();
            const current = counts.get(weekday) ?? { total: 0, completed: 0 };
            current.total += 1;
            if (entry.isComplete) current.completed += 1;
            counts.set(weekday, current);
        });

        const rawData = WEEKDAY_LABELS.map((label, index) => {
            const count = counts.get(index) ?? { total: 0, completed: 0 };
            return {
                key: `${index}`,
                label: label.slice(0, 3),
                value: count.total,
                valueLabel: `${count.total}`,
                description: `${count.total} entr${count.total === 1 ? 'y' : 'ies'}, ${count.completed} finished`,
                completedCount: count.completed,
                totalCount: count.total,
                isHighlight: false,
                isEmpty: count.total === 0,
            };
        });

        return {
            id: 'weekday',
            title: 'Weekday rhythm',
            description: 'Entry volume by weekday over the last 12 weeks.',
            totalLabel: `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} in 12 weeks`,
            data: highlightStrongestDatum(rawData),
        };
    }

    const expectedDates = getExpectedDatesInRange(
        context.cadence,
        start.format('YYYY-MM-DD'),
        context.effectiveAnchorDate,
    );
    const expectedCounts = new Map<number, number>();
    const completedCounts = new Map<number, number>();
    expectedDates.forEach(date => {
        const weekday = moment(date, 'YYYY-MM-DD', true).day();
        expectedCounts.set(weekday, (expectedCounts.get(weekday) ?? 0) + 1);
        if (context.completedEntryByDate.has(date)) {
            completedCounts.set(weekday, (completedCounts.get(weekday) ?? 0) + 1);
        }
    });

    const rawData = WEEKDAY_LABELS.map((label, index) => {
        const expected = expectedCounts.get(index) ?? 0;
        const completed = completedCounts.get(index) ?? 0;
        const rate = expected > 0 ? Math.round((completed / expected) * 100) : 0;
        return {
            key: `${index}`,
            label: label.slice(0, 3),
            value: rate,
            valueLabel: expected > 0 ? `${rate}%` : 'Off',
            description: expected > 0
                ? `${completed} of ${expected} expected entries completed`
                : 'Not scheduled on this weekday',
            completedCount: completed,
            totalCount: expected,
            isHighlight: false,
            isEmpty: expected === 0,
        };
    });

    return {
        id: 'weekday',
        title: 'Weekday rhythm',
        description: 'Completion rate on expected weekdays over the last 12 weeks.',
        totalLabel: `${completedEntries.length} finished entr${completedEntries.length === 1 ? 'y' : 'ies'} in 12 weeks`,
        data: highlightStrongestDatum(rawData),
    };
}

function buildMonthlyVolume(context: AnalyticsContext): AnalyticsChartSeries {
    const start = context.effectiveAnchor.clone().subtract(11, 'months').startOf('month');
    const entries = getEntriesInRange(context.entriesThroughAnchor, start, context.effectiveAnchor);
    const counts = new Map<string, { total: number; completed: number }>();
    entries.forEach(entry => {
        const month = moment(entry.date, 'YYYY-MM-DD', true).format('YYYY-MM');
        const current = counts.get(month) ?? { total: 0, completed: 0 };
        current.total += 1;
        if (entry.isComplete) current.completed += 1;
        counts.set(month, current);
    });

    const rawData = Array.from({ length: 12 }, (_, index) => {
        const month = context.effectiveAnchor.clone().subtract(11 - index, 'months');
        const key = month.format('YYYY-MM');
        const count = counts.get(key) ?? { total: 0, completed: 0 };
        return {
            key,
            label: month.format('MMM'),
            value: count.total,
            valueLabel: `${count.total}`,
            description: `${count.total} entr${count.total === 1 ? 'y' : 'ies'}, ${count.completed} finished`,
            completedCount: count.completed,
            totalCount: count.total,
            isHighlight: false,
            isEmpty: count.total === 0,
        };
    });

    return {
        id: 'monthly',
        title: 'Monthly volume',
        description: 'Recognized entries per month across the trailing year.',
        totalLabel: `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} in 12 months`,
        data: highlightStrongestDatum(rawData),
    };
}

function highlightStrongestDatum(data: AnalyticsChartSeries['data']) {
    const strongest = data
        .filter(item => !item.isEmpty)
        .sort((left, right) => right.value - left.value || right.totalCount - left.totalCount)[0];

    return data.map(item => ({
        ...item,
        isHighlight: !!strongest && item.key === strongest.key,
    }));
}

function buildAnalyticsInsights(
    context: AnalyticsContext,
    weekdayRhythm: AnalyticsChartSeries,
    isAdHoc: boolean,
): AnalyticsInsight[] {
    const insights: AnalyticsInsight[] = [];
    const strongestWeekday = weekdayRhythm.data
        .filter(item => isAdHoc ? item.totalCount > 0 : item.totalCount >= 3)
        .sort((left, right) => right.value - left.value || right.totalCount - left.totalCount)[0];

    if (strongestWeekday) {
        const weekday = WEEKDAY_LABELS[Number.parseInt(strongestWeekday.key, 10)];
        insights.push(isAdHoc
            ? {
                id: 'strongest-weekday',
                tone: 'accent',
                icon: 'calendar-days',
                title: `${weekday}s are your busiest`,
                description: `${strongestWeekday.totalCount} entries landed on ${weekday}s over the last 12 weeks.`,
            }
            : {
                id: 'strongest-weekday',
                tone: 'success',
                icon: 'trending-up',
                title: `${weekday}s are your strongest`,
                description: `${strongestWeekday.value}% completion across ${strongestWeekday.totalCount} expected ${weekday}s in the last 12 weeks.`,
            });
    }

    if (isAdHoc) {
        const busiestMonth = context.entriesThroughAnchor.length >= 3
            ? buildMonthlyVolume(context).data
                .filter(item => item.totalCount > 0)
                .sort((left, right) => right.totalCount - left.totalCount)[0]
            : null;
        if (busiestMonth) {
            insights.push({
                id: 'busiest-month',
                tone: 'accent',
                icon: 'chart-no-axes-column-increasing',
                title: `${moment(busiestMonth.key, 'YYYY-MM').format('MMMM')} carried the most activity`,
                description: `${busiestMonth.totalCount} entries were created during that month.`,
            });
        }
    } else {
        const comparison = createAnalyticsPeriodComparison(90, context);
        const comparable = comparison.current.totalDays >= 4 && comparison.previous.totalDays >= 4;
        if (comparable && Math.abs(comparison.delta) >= 5) {
            insights.push(comparison.delta > 0
                ? {
                    id: 'ninety-day-momentum',
                    tone: 'success',
                    icon: 'trending-up',
                    title: 'Your 90-day rhythm is improving',
                    description: `Completion rose ${comparison.delta} points compared with the preceding 90 days.`,
                }
                : {
                    id: 'ninety-day-momentum',
                    tone: 'warning',
                    icon: 'trending-down',
                    title: 'Your 90-day rhythm has eased',
                    description: `Completion is ${Math.abs(comparison.delta)} points lower than the preceding 90 days.`,
                });
        } else {
            const monthlyInsight = buildMonthlyCompletionInsight(context);
            if (monthlyInsight) insights.push(monthlyInsight);
        }
    }

    if (insights.length === 0) {
        return [{
            id: 'building-patterns',
            tone: 'neutral',
            icon: 'sparkles',
            title: 'Patterns are still taking shape',
            description: 'Keep writing and Journalyst will surface reliable weekday and momentum signals here.',
        }];
    }

    return insights.slice(0, 2);
}

function buildMonthlyCompletionInsight(context: AnalyticsContext): AnalyticsInsight | null {
    const start = context.effectiveAnchor.clone().subtract(11, 'months').startOf('month');
    const overall = createPeriodSummary(
        'Trailing year',
        start,
        context.effectiveAnchor,
        context.completedEntryByDate,
        context.cadence,
    );
    const months = Array.from({ length: 12 }, (_, index) => {
        const month = context.effectiveAnchor.clone().subtract(11 - index, 'months');
        const end = moment.min(month.clone().endOf('month'), context.effectiveAnchor);
        return createPeriodSummary(
            month.format('MMMM YYYY'),
            month.clone().startOf('month'),
            end,
            context.completedEntryByDate,
            context.cadence,
        );
    }).filter(month => month.totalDays >= 2);

    if (overall.totalDays === 0 || months.length === 0) return null;

    const softest = [...months].sort((left, right) => left.completionRate - right.completionRate)[0];
    if (softest.completionRate <= overall.completionRate - 10) {
        return {
            id: 'softest-month',
            tone: 'warning',
            icon: 'calendar-clock',
            title: `${softest.label} was a softer month`,
            description: `${softest.completionRate}% completion compared with ${overall.completionRate}% across the trailing year.`,
        };
    }

    const strongest = [...months].sort((left, right) => right.completionRate - left.completionRate)[0];
    if (strongest.completionRate >= overall.completionRate + 10) {
        return {
            id: 'strongest-month',
            tone: 'success',
            icon: 'calendar-check-2',
            title: `${strongest.label} stood out`,
            description: `${strongest.completionRate}% completion compared with ${overall.completionRate}% across the trailing year.`,
        };
    }

    return null;
}

function buildRankedWeeks(context: AnalyticsContext) {
    const currentWeekStart = context.effectiveAnchor.clone().startOf('week');
    const weeks: AnalyticsRankedWeek[] = [];

    for (let index = 12; index >= 1; index -= 1) {
        const start = currentWeekStart.clone().subtract(index, 'weeks');
        const end = start.clone().endOf('week');
        const summary = createPeriodSummary(
            `Week of ${start.format('MMM D')} - ${end.format('MMM D')}`,
            start,
            end,
            context.completedEntryByDate,
            context.cadence,
        );
        if (summary.totalDays > 0) {
            weeks.push({
                ...summary,
                reviewAnchorDate: summary.endDate,
            });
        }
    }

    const strongest = [...weeks].sort((left, right) => (
        right.completionRate - left.completionRate
        || right.completedDays - left.completedDays
        || right.startDate.localeCompare(left.startDate)
    ))[0] ?? null;
    const lowest = weeks.length >= 2
        ? [...weeks].sort((left, right) => (
            left.completionRate - right.completionRate
            || left.completedDays - right.completedDays
            || right.startDate.localeCompare(left.startDate)
        ))[0] ?? null
        : null;

    return { strongest, lowest };
}

function buildYearActivity(context: AnalyticsContext): YearActivityCell[] {
    const start = context.anchor.clone().startOf('year');
    const end = context.anchor.clone().endOf('year');
    const cells: YearActivityCell[] = [];
    let cursor = start.clone();

    while (cursor.isSameOrBefore(end, 'day')) {
        const date = cursor.format('YYYY-MM-DD');
        const entry = context.entryByDate.get(date) ?? null;
        const isFuture = date > context.effectiveAnchorDate;
        const isExpected = !isFuture && isExpectedOnDate(context.cadence, date);
        const state = isFuture
            ? 'future'
            : entry
                ? entry.isComplete ? 'complete' : 'draft'
                : date < context.trackingStartDate || !isExpected ? 'skipped' : 'missing-expected';

        cells.push({
            date,
            hasEntry: !!entry,
            isComplete: entry?.isComplete ?? false,
            isExpected,
            filePath: entry?.filePath ?? null,
            monthLabel: cursor.format('MMM'),
            dayLabel: cursor.format('D'),
            state,
        });
        cursor.add(1, 'day');
    }

    return cells;
}

function buildCadencePerformance(
    context: AnalyticsContext,
    isAdHoc: boolean,
): AnalyticsPerformanceMetric[] {
    if (isAdHoc) {
        const start = context.effectiveAnchor.clone().subtract(89, 'days');
        const entries = getEntriesInRange(context.entriesThroughAnchor, start, context.effectiveAnchor);
        return [buildFinishedEntryMetric(entries, 'Recognized entries from the last 90 days.')];
    }

    const expectedDates = getExpectedDatesInRange(
        context.cadence,
        context.trackingStartDate,
        context.effectiveAnchorDate,
    ).slice(-120);
    const completedExpected = expectedDates.filter(date => context.completedEntryByDate.has(date)).length;
    const expectedMetric: AnalyticsPerformanceMetric = {
        id: 'expected-hit-rate',
        label: 'Expected-day hit rate',
        description: expectedDates.length > 0
            ? `Latest ${expectedDates.length} expected day${expectedDates.length === 1 ? '' : 's'}.`
            : 'No expected days are available yet.',
        completed: completedExpected,
        total: expectedDates.length,
        percentage: expectedDates.length > 0
            ? Math.round((completedExpected / expectedDates.length) * 100)
            : 0,
        tracked: expectedDates.length > 0,
    };
    const performanceStart = expectedDates[0]
        ? moment(expectedDates[0], 'YYYY-MM-DD', true)
        : context.effectiveAnchor.clone().subtract(89, 'days');
    const entries = getEntriesInRange(context.entriesThroughAnchor, performanceStart, context.effectiveAnchor);

    return [
        expectedMetric,
        buildFinishedEntryMetric(entries, 'Recognized entries across the same calendar span.'),
    ];
}

function buildFinishedEntryMetric(
    entries: JournalEntryRecord[],
    description: string,
): AnalyticsPerformanceMetric {
    const completed = entries.filter(entry => entry.isComplete).length;
    return {
        id: 'finished-entry-rate',
        label: 'Finished-entry rate',
        description,
        completed,
        total: entries.length,
        percentage: entries.length > 0 ? Math.round((completed / entries.length) * 100) : 0,
        tracked: entries.length > 0,
    };
}

function getEntriesInRange(
    entries: JournalEntryRecord[],
    start: moment.Moment,
    end: moment.Moment,
) {
    const startDate = start.format('YYYY-MM-DD');
    const endDate = end.format('YYYY-MM-DD');
    return entries.filter(entry => entry.date >= startDate && entry.date <= endDate);
}

function formatPointComparison(delta: number) {
    if (delta === 0) return 'No change vs prior';
    return `${delta > 0 ? '+' : ''}${delta} points vs prior`;
}

function formatDecimalComparison(delta: number) {
    if (Math.abs(delta) < 0.05) return 'No change vs prior';
    return `${delta > 0 ? '+' : ''}${delta.toFixed(1)} vs prior`;
}

function formatCountComparison(delta: number) {
    if (delta === 0) return 'No change vs prior';
    return delta > 0 ? `+${delta} vs prior` : `${Math.abs(delta)} fewer vs prior`;
}

function getComparisonTone(delta: number): AnalyticsSummaryMetric['comparisonTone'] {
    if (delta > 0) return 'success';
    if (delta < 0) return 'warning';
    return 'neutral';
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
