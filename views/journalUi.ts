import moment from "moment";
import JournalystPlugin from "../src/main";
import {
    type JournalOverviewData,
    buildJournalHomeSummary,
    buildJournalOverviewData,
} from "../review/buildHomeSnapshot";

export {
    buildJournalHomeSummary,
    buildJournalOverviewData,
};
export type {
    JournalHeatmapDay,
    JournalHomeSummary,
    JournalOverviewData,
} from "../review/buildHomeSnapshot";

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
            dayEl.addClass(day.isComplete ? "heat-map-day-exists" : "heat-map-day-draft");
        }

        const actionLabel = day.isComplete
            ? 'Open journal entry'
            : day.hasEntry
                ? 'Open unfinished journal entry'
                : 'Create journal entry';
        dayEl.setAttr('aria-label', `${actionLabel} for ${day.date}`);
        dayEl.setAttr('title', `${actionLabel} for ${day.date}`);
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
        text: overview.todayFile
            ? overview.todayIsComplete ? "Open today" : "Open unfinished entry"
            : "Go to today",
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
