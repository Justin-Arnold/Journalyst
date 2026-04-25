import { ItemView, WorkspaceLeaf, TFolder, moment } from "obsidian";
import { getCadenceStatus } from "../cadence";
import JournalystPlugin from "../main";


export const VIEW_TYPE_SIDE_BAR = "journalyst-side-bar-view";

export class SideBarView extends ItemView {
    plugin: JournalystPlugin;
    rootContainer: Element;

    constructor(leaf: WorkspaceLeaf, plugin: JournalystPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return VIEW_TYPE_SIDE_BAR;
    }

    getDisplayText() {
        return "Journalyst";
    }

    async onOpen() {
        this.rootContainer = this.containerEl.children[1];
        this.rootContainer.empty();
        this.addHeader();
        this.addJournalSections();

        // Register file system event listeners
        this.registerEvent(
            this.app.vault.on('create', () => this.onFileChanged())
        );
        this.registerEvent(
            this.app.vault.on('delete', () => this.onFileChanged())
        );
        this.registerEvent(
            this.app.vault.on('modify', () => this.onFileChanged())
        );
        this.registerEvent(
            this.app.vault.on('rename', (item) => this.onFileChanged())
        );
    }

    private onFileChanged() {
        this.rootContainer = this.containerEl.children[1];
        this.rootContainer.empty();
        this.addHeader();
        this.addJournalSections();
    }

    async onClose() {
        // Nothing to clean up.
    }

    private addHeader(): void {
        this.rootContainer.createEl("h3", { text: "Journals" });
    }

    private addJournalSections(): void {
        this.plugin.journals.forEach((journal: TFolder) => {
            const journalSection = this.rootContainer.createEl("div")
            journalSection.addClass("journal-section");
            journalSection.createEl("h4", { text: journal.name });
            this.addCadenceSummary(journal, journalSection);

            this.createHeatMap(journal, journalSection)

            const actions = journalSection.createEl("div", { cls: "journal-section-actions" });

            const gotoButton = actions.createEl("button", { text: "Go to today" });
            gotoButton.addClass("journal-section-button");
            gotoButton.addEventListener("click", () => {
                this.plugin.createJournalEntry(journal);
            });

            const reviewButton = actions.createEl("button", { text: "Review" });
            reviewButton.addClass("journal-section-button");
            reviewButton.addEventListener("click", () => {
                this.plugin.activateReviewView(journal.path);
            });
        });
    }

    private createHeatMap(journal: TFolder, journalSection: HTMLElement): void {
        const heatMapWrapper = journalSection.createEl("div", { cls: "heat-map-wrapper" });

        const days = ['S', 'M', 'T', 'W', 'Th', 'F', 'S'];



        days.forEach(day => {
            const dayEl = heatMapWrapper.createEl('span', { text: day });
            dayEl.addClass('heat-map-day-label');
        });


        const startOfMonthOffset = moment().startOf('month').day();
        for (let i = 0; i < startOfMonthOffset; i++) {
            const day = heatMapWrapper.createEl("div", { cls: "heat-map-offset" });
        }

        const daysInMonth = moment().daysInMonth();
        for (let i = 1; i <= daysInMonth; i++) {
            const day = heatMapWrapper.createEl("div", { cls: "heat-map-day", text: String(i) });
            const dayDate = `${moment().format("YYYY-MM")}-${String(i).padStart(2, '0')}`;
            day.addEventListener("click", () => {
                this.plugin.createJournalEntry(journal, dayDate);
            });
            const dayFile = this.plugin.findJournalEntryFile(journal, dayDate);
            if (dayFile) {
                day.addClass("heat-map-day-exists");
            }
        }
    }

    private addCadenceSummary(journal: TFolder, journalSection: HTMLElement) {
        const cadence = this.plugin.getJournalCadence(journal.path);
        const entryDates = journal.children
            .map(file => this.plugin.parseJournalDateFromFile(file))
            .filter((date): date is string => !!date)
            .sort();
        const dateSet = new Set(entryDates);
        const today = moment().format('YYYY-MM-DD');
        const cadenceStatus = getCadenceStatus(cadence, dateSet, today, entryDates[0] ?? null);
        const summary = journalSection.createDiv({ cls: 'journal-section-meta' });
        summary.createEl('span', { text: cadenceStatus.cadenceLabel, cls: 'journal-section-meta-label' });

        let statusText = 'Flexible pace';
        if (cadenceStatus.isTracked) {
            if (cadenceStatus.expectedToday && !dateSet.has(today)) {
                statusText = 'Due today';
            } else if (cadenceStatus.outstandingMisses > 0) {
                statusText = `${cadenceStatus.outstandingMisses} missed`;
            } else if (dateSet.has(today)) {
                statusText = 'On track';
            } else if (cadenceStatus.nextExpectedDate) {
                statusText = `Next ${cadenceStatus.nextExpectedDate}`;
            }
        }

        summary.createEl('span', { text: statusText, cls: 'journal-section-meta-status' });
    }
}
