import { TFile, type TFolder, normalizePath } from "obsidian";
import moment from "moment";
import {
    getCadenceTimelineStartDate,
    getCadenceStatus,
    getCurrentCadenceStreak,
    isExpectedOnDate,
} from "../cadence";
import {
    buildSynthesisReminderFileName,
    getPendingReviewReminderEventsForJournal,
} from "../reminders";
import type JournalystPlugin from "../src/main";
import type { SynthesisPeriodType } from "./types";

export interface JournalHeatmapDay {
    date: string;
    dayNumber: number;
    hasEntry: boolean;
    isBeforeTrackingStart: boolean;
    isComplete: boolean;
    isExpected: boolean;
    isToday: boolean;
    state: JournalHeatmapDayState;
}

export type JournalHeatmapDayState =
    | 'complete'
    | 'draft'
    | 'due-today'
    | 'unfinished-today'
    | 'missing-expected'
    | 'empty'
    | 'skipped'
    | 'future';

export type JournalHomeCardStatus = {
    kind: 'unfinished-today' | 'due-today' | 'on-track' | 'ad-hoc';
} | {
    kind: 'streak';
    count: number;
};

export interface JournalOverviewData {
    journal: TFolder;
    todayDate: string;
    todayFile: TFile | null;
    todayIsComplete: boolean;
    cadenceLabel: string;
    cadenceStatusText: string;
    cardStatus: JournalHomeCardStatus;
    currentStreak: number;
    entryCount: number;
    isTracked: boolean;
    reminderDisplayText: string;
    reminderStatusText: string;
    outstandingMisses: number;
    catchUpCount: number;
    dueToday: boolean;
    heatmapDays: JournalHeatmapDay[];
}

export interface JournalHomeSummary {
    dueTodayCount: number;
    catchUpEntryCount: number;
    missedCount: number;
    missedJournalCount: number;
    remindersActiveCount: number;
    remindersInactiveCount: number;
    totalEntries: number;
    totalJournals: number;
    currentStreak: number;
    longestStreak: number;
}

export type JournalHomeAttentionTarget = {
    type: 'entry';
    journalPath: string;
    date: string;
} | {
    type: 'synthesis';
    journalPath: string;
    anchorDate: string;
    periodType: SynthesisPeriodType;
};

type JournalHomeEntryAttentionTarget = Extract<JournalHomeAttentionTarget, { type: 'entry' }>;
type JournalHomeSynthesisAttentionTarget = Extract<JournalHomeAttentionTarget, { type: 'synthesis' }>;

export type JournalHomeAttentionItem = {
    kind: 'due-today' | 'unfinished-today';
    count: number;
    target: JournalHomeEntryAttentionTarget;
} | {
    kind: 'streak-at-risk';
    count: number;
    streakLength: number;
    target: JournalHomeEntryAttentionTarget;
} | {
    kind: 'reviews-due';
    count: number;
    target: JournalHomeSynthesisAttentionTarget;
};

interface JournalHomeAttentionBuildOptions {
    now?: moment.Moment;
    summary?: JournalHomeSummary;
}

interface WorkspaceWritingStreaks {
    current: number;
    longest: number;
}

function getJournalEntries(plugin: JournalystPlugin, journal: TFolder) {
    return journal.children
        .map(file => {
            if (!(file instanceof TFile)) {
                return null;
            }

            const date = plugin.parseJournalDateFromFile(file);
            return date ? {
                date,
                file,
                isComplete: plugin.isJournalEntryComplete(file),
            } : null;
        })
        .filter((entry): entry is { date: string; file: TFile; isComplete: boolean } => !!entry)
        .sort((left, right) => left.date.localeCompare(right.date));
}

function getWorkspaceWritingStreaks(entryDates: Set<string>, todayDate: string): WorkspaceWritingStreaks {
    const today = moment(todayDate, 'YYYY-MM-DD', true);
    const datesThroughToday = [...entryDates]
        .filter(date => date <= todayDate)
        .sort();

    let longest = 0;
    let running = 0;
    let previousDate: moment.Moment | null = null;

    datesThroughToday.forEach(date => {
        const currentDate = moment(date, 'YYYY-MM-DD', true);
        running = previousDate && currentDate.diff(previousDate, 'days') === 1
            ? running + 1
            : 1;
        longest = Math.max(longest, running);
        previousDate = currentDate;
    });

    let current = 0;
    const cursor = entryDates.has(todayDate)
        ? today.clone()
        : today.clone().subtract(1, 'day');

    while (entryDates.has(cursor.format('YYYY-MM-DD'))) {
        current += 1;
        cursor.subtract(1, 'day');
    }

    return { current, longest };
}

function getReminderDisplayText(plugin: JournalystPlugin, journalPath: string, isTracked: boolean) {
    if (!plugin.areRemindersEnabled()) {
        return 'Off';
    }

    const settings = plugin.getJournalReminderSettings(journalPath);
    if (isTracked && settings.entryReminder.enabled) {
        return settings.entryReminder.time;
    }

    const reviewReminders = settings.reviewReminders;
    return reviewReminders.weekly.enabled
        || reviewReminders.monthly.enabled
        || reviewReminders.quarterly.enabled
        ? 'Reviews'
        : 'Off';
}

export function buildJournalOverviewData(plugin: JournalystPlugin, journal: TFolder): JournalOverviewData {
    const cadence = plugin.getJournalCadenceSchedule(journal.path);
    const entries = getJournalEntries(plugin, journal);
    const entryByDate = new Map(entries.map(entry => [entry.date, entry]));
    const completedDateSet = new Set(entries.filter(entry => entry.isComplete).map(entry => entry.date));
    const todayDate = moment().format('YYYY-MM-DD');
    const yesterdayDate = moment(todayDate, 'YYYY-MM-DD', true).subtract(1, 'day').format('YYYY-MM-DD');
    const firstEntryDate = entries[0]?.date ?? null;
    const trackingStartDate = getCadenceTimelineStartDate(cadence) ?? firstEntryDate ?? todayDate;
    const cadenceStatus = getCadenceStatus(cadence, completedDateSet, todayDate, firstEntryDate);
    const catchUpStatus = getCadenceStatus(cadence, completedDateSet, yesterdayDate, firstEntryDate);
    const currentStreak = getCurrentCadenceStreak(cadence, completedDateSet, todayDate);

    let cadenceStatusText = 'Flexible pace';
    if (cadenceStatus.isTracked) {
        if (cadenceStatus.expectedToday && !completedDateSet.has(todayDate)) {
            cadenceStatusText = 'Due today';
        } else if (cadenceStatus.outstandingMisses > 0) {
            cadenceStatusText = `${cadenceStatus.outstandingMisses} missed`;
        } else if (completedDateSet.has(todayDate)) {
            cadenceStatusText = 'On track';
        } else if (cadenceStatus.nextExpectedDate) {
            cadenceStatusText = `Next ${cadenceStatus.nextExpectedDate}`;
        }
    }

    const heatmapDays: JournalHeatmapDay[] = [];
    const monthPrefix = moment().format('YYYY-MM');
    const daysInMonth = moment().daysInMonth();

    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = `${monthPrefix}-${String(day).padStart(2, '0')}`;
        const entry = entryByDate.get(date);
        const isExpected = isExpectedOnDate(cadence, date);
        const isToday = date === todayDate;
        const isBeforeTrackingStart = date < trackingStartDate;
        const isEarlierExpectedGap = !isBeforeTrackingStart
            && date < todayDate
            && isExpected
            && !entry;
        const state: JournalHeatmapDayState = entry
            ? entry.isComplete ? 'complete'
                : isToday && isExpected ? 'unfinished-today' : 'draft'
            : isBeforeTrackingStart ? 'skipped'
                : isEarlierExpectedGap ? 'missing-expected'
                : date > todayDate ? 'future'
                    : isToday && isExpected ? 'due-today'
                    : !isExpected ? 'skipped' : 'empty';

        heatmapDays.push({
            date,
            dayNumber: day,
            hasEntry: !!entry,
            isBeforeTrackingStart,
            isComplete: entry?.isComplete ?? false,
            isExpected,
            isToday,
            state,
        });
    }

    const todayEntry = entryByDate.get(todayDate);
    const dueToday = cadenceStatus.isTracked && cadenceStatus.expectedToday && !completedDateSet.has(todayDate);
    const cardStatus: JournalHomeCardStatus = todayEntry && !todayEntry.isComplete
        ? { kind: 'unfinished-today' }
        : dueToday
            ? { kind: 'due-today' }
            : currentStreak > 0
                ? { kind: 'streak', count: currentStreak }
                : cadenceStatus.isTracked
                    ? { kind: 'on-track' }
                    : { kind: 'ad-hoc' };

    return {
        journal,
        todayDate,
        todayFile: todayEntry?.file ?? null,
        todayIsComplete: todayEntry?.isComplete ?? false,
        cadenceLabel: cadenceStatus.cadenceLabel,
        cadenceStatusText,
        cardStatus,
        currentStreak,
        entryCount: entries.length,
        isTracked: cadenceStatus.isTracked,
        reminderDisplayText: getReminderDisplayText(plugin, journal.path, cadenceStatus.isTracked),
        reminderStatusText: plugin.getJournalReminderSummary(journal.path),
        outstandingMisses: cadenceStatus.outstandingMisses,
        catchUpCount: catchUpStatus.outstandingMisses,
        dueToday,
        heatmapDays,
    };
}

export function buildJournalHomeSummary(
    plugin: JournalystPlugin,
    overviews = plugin.journals.map(journal => buildJournalOverviewData(plugin, journal)),
): JournalHomeSummary {
    const journalEntries = plugin.journals.map(journal => getJournalEntries(plugin, journal));
    const workspaceEntryDates = new Set(journalEntries.flat()
        .filter(entry => entry.isComplete)
        .map(entry => entry.date));
    const streaks = getWorkspaceWritingStreaks(workspaceEntryDates, moment().format('YYYY-MM-DD'));
    const remindersActiveCount = overviews
        .filter(overview => overview.reminderStatusText === 'Reminders active').length;

    return {
        dueTodayCount: overviews.filter(overview => overview.dueToday).length,
        catchUpEntryCount: overviews.reduce((sum, overview) => sum + overview.catchUpCount, 0),
        missedCount: overviews.reduce((sum, overview) => sum + overview.outstandingMisses, 0),
        missedJournalCount: overviews.filter(overview => overview.outstandingMisses > 0).length,
        remindersActiveCount,
        remindersInactiveCount: overviews.length - remindersActiveCount,
        totalEntries: journalEntries.reduce((sum, entries) => sum + entries.length, 0),
        totalJournals: overviews.length,
        currentStreak: streaks.current,
        longestStreak: streaks.longest,
    };
}

export function buildJournalHomeAttentionItems(
    plugin: JournalystPlugin,
    overviews = plugin.journals.map(journal => buildJournalOverviewData(plugin, journal)),
    options: JournalHomeAttentionBuildOptions = {},
): JournalHomeAttentionItem[] {
    const now = options.now ?? moment();
    const summary = options.summary ?? buildJournalHomeSummary(plugin, overviews);
    const items: JournalHomeAttentionItem[] = [];
    const missingToday = overviews.filter(overview => overview.dueToday && !overview.todayFile);
    const unfinishedToday = overviews.filter(overview => overview.todayFile && !overview.todayIsComplete);
    const firstMissingToday = missingToday[0];
    const firstUnfinishedToday = unfinishedToday[0];
    const hasCompletedEntryToday = overviews.some(overview => overview.todayIsComplete);

    if (firstMissingToday) {
        const target: JournalHomeEntryAttentionTarget = {
            type: 'entry',
            journalPath: firstMissingToday.journal.path,
            date: firstMissingToday.todayDate,
        };

        items.push(summary.currentStreak > 0 && !hasCompletedEntryToday
            ? {
                kind: 'streak-at-risk',
                count: missingToday.length,
                streakLength: summary.currentStreak,
                target,
            }
            : {
                kind: 'due-today',
                count: missingToday.length,
                target,
            });
    }

    if (firstUnfinishedToday) {
        items.push({
            kind: 'unfinished-today',
            count: unfinishedToday.length,
            target: {
                type: 'entry',
                journalPath: firstUnfinishedToday.journal.path,
                date: firstUnfinishedToday.todayDate,
            },
        });
    }

    if (!plugin.areRemindersEnabled()) {
        return items;
    }

    const pendingReviews = overviews.flatMap((overview, journalIndex) =>
        getPendingReviewReminderEventsForJournal({
            journalName: overview.journal.name,
            journalPath: overview.journal.path,
            reminderSettings: plugin.getJournalReminderSettings(overview.journal.path),
            synthesisNoteExists: (period, anchorDate) => {
                const fileName = buildSynthesisReminderFileName(period, anchorDate);
                return !!plugin.app.vault.getFileByPath(normalizePath(`${overview.journal.path}/${fileName}`));
            },
        }, now)
            .filter(event => event.dueDate === now.format('YYYY-MM-DD'))
            .map((event, eventIndex) => ({ event, journalIndex, eventIndex }))
    ).sort((left, right) =>
        left.event.target.anchorDate.localeCompare(right.event.target.anchorDate)
        || left.journalIndex - right.journalIndex
        || left.eventIndex - right.eventIndex
    );
    const firstPendingReview = pendingReviews[0]?.event;

    if (firstPendingReview) {
        items.push({
            kind: 'reviews-due',
            count: pendingReviews.length,
            target: {
                type: 'synthesis',
                journalPath: firstPendingReview.journalPath,
                anchorDate: firstPendingReview.target.anchorDate,
                periodType: firstPendingReview.target.reviewPeriod,
            },
        });
    }

    return items;
}
