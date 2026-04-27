import { TFolder, TFile } from "obsidian";
import moment from "moment";
import { getCadenceStatus } from "../cadence";
import JournalystPlugin from "../src/main";

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
    remindersActiveCount: number;
    totalJournals: number;
}

export function buildJournalOverviewData(plugin: JournalystPlugin, journal: TFolder): JournalOverviewData {
    const cadence = plugin.getJournalCadence(journal.path);
    const entryDates = journal.children
        .map(file => plugin.parseJournalDateFromFile(file))
        .filter((date): date is string => !!date)
        .sort();
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

    return {
        dueTodayCount: overviews.filter(overview => overview.dueToday).length,
        missedCount: overviews.reduce((sum, overview) => sum + overview.outstandingMisses, 0),
        remindersActiveCount: overviews.filter(overview => overview.reminderStatusText === 'Reminders active').length,
        totalJournals: overviews.length,
    };
}

export function renderJournalHeatmap(
    container: HTMLElement,
    overview: JournalOverviewData,
    onSelectDate: (date: string) => void,
) {
    const heatMapWrapper = container.createEl("div", { cls: "heat-map-wrapper" });
    const days = ['S', 'M', 'T', 'W', 'Th', 'F', 'S'];

    days.forEach(day => {
        const dayEl = heatMapWrapper.createEl('span', { text: day });
        dayEl.addClass('heat-map-day-label');
    });

    const startOfMonthOffset = moment().startOf('month').day();
    for (let index = 0; index < startOfMonthOffset; index += 1) {
        heatMapWrapper.createEl("div", { cls: "heat-map-offset" });
    }

    overview.heatmapDays.forEach(day => {
        const dayEl = heatMapWrapper.createEl("div", { cls: "heat-map-day", text: String(day.dayNumber) });
        dayEl.addEventListener("click", () => {
            onSelectDate(day.date);
        });

        if (day.hasEntry) {
            dayEl.addClass("heat-map-day-exists");
        }
    });
}

export function renderJournalActionButtons(
    container: HTMLElement,
    plugin: JournalystPlugin,
    overview: JournalOverviewData,
    options?: {
        includeSynthesis?: boolean;
        compact?: boolean;
    },
) {
    const actions = container.createEl("div", {
        cls: options?.compact ? "journal-section-actions journalyst-home-actions-compact" : "journal-section-actions",
    });

    const todayButton = actions.createEl("button", {
        text: overview.todayFile ? "Open today" : "Go to today",
        cls: "journal-section-button",
    });
    todayButton.addEventListener("click", () => {
        void plugin.createJournalEntry(overview.journal);
    });

    const reviewButton = actions.createEl("button", { text: "Review", cls: "journal-section-button" });
    reviewButton.addEventListener("click", () => {
        void plugin.activateReviewView(overview.journal.path, undefined, 'review');
    });

    if (options?.includeSynthesis) {
        const synthesisButton = actions.createEl("button", { text: "Synthesis", cls: "journal-section-button" });
        synthesisButton.addEventListener("click", () => {
            void plugin.activateReviewView(overview.journal.path, undefined, 'synthesis');
        });
    }
}
