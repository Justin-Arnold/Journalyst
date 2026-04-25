import { ItemView, WorkspaceLeaf } from "obsidian";
import { buildJournalHomeSummary, buildJournalOverviewData, renderJournalActionButtons, renderJournalHeatmap } from "./journalUi";
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
        return "Journalyst Sidebar";
    }

    getIcon() {
        return "notebook";
    }

    async onOpen() {
        this.rootContainer = this.containerEl.children[1];
        this.renderView();

        this.registerEvent(this.app.vault.on('create', () => this.onFileChanged()));
        this.registerEvent(this.app.vault.on('delete', () => this.onFileChanged()));
        this.registerEvent(this.app.vault.on('modify', () => this.onFileChanged()));
        this.registerEvent(this.app.vault.on('rename', () => this.onFileChanged()));
    }

    renderView() {
        this.plugin.refreshJournals();
        this.rootContainer = this.containerEl.children[1];
        this.rootContainer.empty();
        this.rootContainer.addClass('journalyst-sidebar-view');

        if (this.plugin.getSidebarMode() === 'home-mini') {
            this.renderHomeMiniView();
            return;
        }

        this.renderJournalsMiniView();
    }

    private onFileChanged() {
        this.renderView();
    }

    async onClose() {
        // Nothing to clean up.
    }

    private renderHomeMiniView() {
        const header = this.rootContainer.createEl('div', { cls: 'journalyst-sidebar-header' });
        header.createEl('h3', { text: 'Home' });
        const openMainButton = header.createEl('button', { text: 'Open workspace', cls: 'journal-section-button' });
        openMainButton.addEventListener('click', () => {
            void this.plugin.activateView();
        });

        const summary = buildJournalHomeSummary(this.plugin);
        const overview = this.rootContainer.createEl('div', { cls: 'journalyst-sidebar-summary' });
        overview.createEl('strong', { text: `${summary.dueTodayCount} due now` });
        overview.createEl('span', { text: `${summary.missedCount} missed | ${summary.remindersActiveCount} reminders active`, cls: 'journalyst-review-meta' });

        this.plugin.journals.forEach(journal => {
            const journalOverview = buildJournalOverviewData(this.plugin, journal);
            const card = this.rootContainer.createEl('div', { cls: 'journalyst-sidebar-mini-card' });
            card.createEl('h4', { text: journal.name });
            const meta = card.createEl('div', { cls: 'journal-section-meta' });
            meta.createEl('span', { text: journalOverview.cadenceStatusText, cls: 'journal-section-meta-status' });
            meta.createEl('span', { text: journalOverview.reminderStatusText, cls: 'journal-section-meta-status' });
            renderJournalActionButtons(card, this.plugin, journalOverview, { compact: true });
        });
    }

    private renderJournalsMiniView() {
        const header = this.rootContainer.createEl('div', { cls: 'journalyst-sidebar-header' });
        header.createEl('h3', { text: 'Journals' });
        const openMainButton = header.createEl('button', { text: 'Open workspace', cls: 'journal-section-button' });
        openMainButton.addEventListener('click', () => {
            void this.plugin.activateView();
        });

        this.plugin.journals.forEach(journal => {
            const overview = buildJournalOverviewData(this.plugin, journal);
            const section = this.rootContainer.createEl("div", { cls: "journal-section" });
            section.createEl("h4", { text: journal.name });

            const meta = section.createEl('div', { cls: 'journal-section-meta' });
            meta.createEl('span', { text: overview.cadenceLabel, cls: 'journal-section-meta-label' });
            meta.createEl('span', { text: overview.cadenceStatusText, cls: 'journal-section-meta-status' });
            meta.createEl('span', { text: overview.reminderStatusText, cls: 'journal-section-meta-status' });

            renderJournalHeatmap(section, overview, (date) => {
                void this.plugin.createJournalEntry(journal, date);
            });
            renderJournalActionButtons(section, this.plugin, overview, { compact: true });
        });
    }
}
