import { type TFile, type TFolder } from "obsidian";
import moment from "moment";
import { getCadenceStatus } from "../cadence";
import type JournalystPlugin from "../src/main";

export interface JournalHeatmapDay {
    date: string;
    dayNumber: number;
    hasEntry: boolean;
}

export interface JournalOverviewData {
    journal: TFolder;
    todayDate: string;
    todayFile: TFile | null;
    cadenceLabel: string;
    cadenceStatusText: string;
    reminderStatusText: string;
    outstandingMisses: number;
    dueToday: boolean;
    heatmapDays: JournalHeatmapDay[];
}

export interface JournalHomeSummary {
    dueTodayCount: number;
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

function getJournalEntryDates(plugin: JournalystPlugin, journal: TFolder) {
    return journal.children
        .map(file => plugin.parseJournalDateFromFile(file))
        .filter((date): date is string => !!date)
        .sort();
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
    const entryDates = getJournalEntryDates(plugin, journal);
    const dateSet = new Set(entryDates);
    const todayDate = moment().format('YYYY-MM-DD');
    const cadenceStatus = getCadenceStatus(cadence, dateSet, todayDate, entryDates[0] ?? null);

    let cadenceStatusText = 'Flexible pace';
    if (cadenceStatus.isTracked) {
        if (cadenceStatus.expectedToday && !dateSet.has(todayDate)) {
            cadenceStatusText = 'Due today';
        } else if (cadenceStatus.outstandingMisses > 0) {
            cadenceStatusText = `${cadenceStatus.outstandingMisses} missed`;
        } else if (dateSet.has(todayDate)) {
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
        heatmapDays.push({
            date,
            dayNumber: day,
            hasEntry: !!plugin.findJournalEntryFile(journal, date),
        });
    }

    return {
        journal,
        todayDate,
        todayFile: plugin.findJournalEntryFile(journal, todayDate),
        cadenceLabel: cadenceStatus.cadenceLabel,
        cadenceStatusText,
        reminderStatusText: plugin.getJournalReminderSummary(journal.path),
        outstandingMisses: cadenceStatus.outstandingMisses,
        dueToday: cadenceStatus.isTracked && cadenceStatus.expectedToday && !dateSet.has(todayDate),
        heatmapDays,
    };
}

export function buildJournalHomeSummary(plugin: JournalystPlugin): JournalHomeSummary {
    const overviews = plugin.journals.map(journal => buildJournalOverviewData(plugin, journal));
    const journalEntryDates = plugin.journals.map(journal => getJournalEntryDates(plugin, journal));
    const workspaceEntryDates = new Set(journalEntryDates.flat());
    const streaks = getWorkspaceWritingStreaks(workspaceEntryDates, moment().format('YYYY-MM-DD'));
    const remindersActiveCount = overviews
        .filter(overview => overview.reminderStatusText === 'Reminders active').length;

    return {
        dueTodayCount: overviews.filter(overview => overview.dueToday).length,
        missedCount: overviews.reduce((sum, overview) => sum + overview.outstandingMisses, 0),
        missedJournalCount: overviews.filter(overview => overview.outstandingMisses > 0).length,
        remindersActiveCount,
        remindersInactiveCount: overviews.length - remindersActiveCount,
        totalEntries: journalEntryDates.reduce((sum, dates) => sum + dates.length, 0),
        totalJournals: overviews.length,
        currentStreak: streaks.current,
        longestStreak: streaks.longest,
    };
}
