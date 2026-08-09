import { TFile, type TFolder } from "obsidian";
import moment from "moment";
import { getCadenceStatus } from "../cadence";
import type JournalystPlugin from "../src/main";

export interface JournalHeatmapDay {
    date: string;
    dayNumber: number;
    hasEntry: boolean;
    isComplete: boolean;
}

export interface JournalOverviewData {
    journal: TFolder;
    todayDate: string;
    todayFile: TFile | null;
    todayIsComplete: boolean;
    cadenceLabel: string;
    cadenceStatusText: string;
    reminderStatusText: string;
    outstandingMisses: number;
    catchUpCount: number;
    dueToday: boolean;
    heatmapDays: JournalHeatmapDay[];
}

export interface JournalHomeSummary {
    dueTodayCount: number;
    catchUpEntryCount: number;
    attentionJournalCount: number;
    missedCount: number;
    missedJournalCount: number;
    remindersActiveCount: number;
    remindersInactiveCount: number;
    totalEntries: number;
    totalJournals: number;
    currentStreak: number;
    longestStreak: number;
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

export function buildJournalOverviewData(plugin: JournalystPlugin, journal: TFolder): JournalOverviewData {
    const cadence = plugin.getJournalCadence(journal.path);
    const entries = getJournalEntries(plugin, journal);
    const entryByDate = new Map(entries.map(entry => [entry.date, entry]));
    const completedDateSet = new Set(entries.filter(entry => entry.isComplete).map(entry => entry.date));
    const todayDate = moment().format('YYYY-MM-DD');
    const yesterdayDate = moment(todayDate, 'YYYY-MM-DD', true).subtract(1, 'day').format('YYYY-MM-DD');
    const firstEntryDate = entries[0]?.date ?? null;
    const cadenceStatus = getCadenceStatus(cadence, completedDateSet, todayDate, firstEntryDate);
    const catchUpStatus = getCadenceStatus(cadence, completedDateSet, yesterdayDate, firstEntryDate);

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
        heatmapDays.push({
            date,
            dayNumber: day,
            hasEntry: !!entry,
            isComplete: entry?.isComplete ?? false,
        });
    }

    const todayEntry = entryByDate.get(todayDate);
    return {
        journal,
        todayDate,
        todayFile: todayEntry?.file ?? null,
        todayIsComplete: todayEntry?.isComplete ?? false,
        cadenceLabel: cadenceStatus.cadenceLabel,
        cadenceStatusText,
        reminderStatusText: plugin.getJournalReminderSummary(journal.path),
        outstandingMisses: cadenceStatus.outstandingMisses,
        catchUpCount: catchUpStatus.outstandingMisses,
        dueToday: cadenceStatus.isTracked && cadenceStatus.expectedToday && !completedDateSet.has(todayDate),
        heatmapDays,
    };
}

export function buildJournalHomeSummary(plugin: JournalystPlugin): JournalHomeSummary {
    const overviews = plugin.journals.map(journal => buildJournalOverviewData(plugin, journal));
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
        attentionJournalCount: overviews.filter(overview => overview.dueToday || overview.catchUpCount > 0).length,
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
