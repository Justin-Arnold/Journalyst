import { ItemView, WorkspaceLeaf } from "obsidian";
import moment from "moment";
import { createApp, markRaw, reactive, type App as VueApp } from "vue";
import MainView from "../src/components/MainView.vue";
import type {
    MainViewActions,
    ReviewViewState,
} from "../src/components/main-view/types";
import type { ReviewWorkspaceTab } from "../review/types";
import JournalystPlugin from "../src/main";
import { NewEntryJournalModal } from "./NewEntryJournalModal";
import { NewJournalModal } from "./NewJournalModal";

export const VIEW_TYPE_REVIEW = "journalyst-review-view";

export class ReviewView extends ItemView {
    private vueApp: VueApp<Element> | null = null;
    private rootContainer: HTMLElement | null = null;
    private readonly viewState = reactive<ReviewViewState>({
        journalPath: null,
        anchorDate: moment().format('YYYY-MM-DD'),
        activeTab: 'review',
        revision: 0,
    });
    private readonly actions: MainViewActions;

    constructor(leaf: WorkspaceLeaf, private readonly plugin: JournalystPlugin) {
        super(leaf);
        this.actions = this.createActions();
    }

    getViewType() {
        return VIEW_TYPE_REVIEW;
    }

    getDisplayText() {
        return "Journalyst";
    }

    getIcon() {
        return "notebook-pen";
    }

    async onOpen() {
        this.rootContainer = this.containerEl.children[1] as HTMLElement;
        this.rootContainer.empty();
        this.rootContainer.addClass('journalyst-review-view');
        this.syncStateFromPlugin();

        const mountTarget = this.rootContainer.createDiv({ cls: 'journalyst-review-app' });
        this.vueApp = createApp(MainView, {
            plugin: markRaw(this.plugin),
            state: this.viewState,
            actions: this.actions,
        });
        this.vueApp.mount(mountTarget);

        this.registerEvent(this.app.vault.on('create', () => this.onReviewDataChanged()));
        this.registerEvent(this.app.vault.on('delete', () => this.onReviewDataChanged()));
        this.registerEvent(this.app.vault.on('rename', () => this.onReviewDataChanged()));
        this.registerEvent(this.app.vault.on('modify', () => this.onReviewDataChanged()));
    }

    async onClose() {
        this.vueApp?.unmount();
        this.vueApp = null;
        this.rootContainer?.empty();
        this.rootContainer = null;
    }

    updateReviewState(journalPath: string | null, anchorDate?: string, activeTab?: ReviewWorkspaceTab) {
        this.viewState.journalPath = journalPath;
        this.viewState.anchorDate = anchorDate ?? this.viewState.anchorDate;
        this.viewState.activeTab = activeTab ?? this.viewState.activeTab;
        this.viewState.revision += 1;
    }

    private createActions(): MainViewActions {
        return {
            completeOnboarding: async (request) => {
                const result = await this.plugin.completeOnboarding(request);
                if (result.ok) {
                    this.syncStateFromPlugin();
                }
                this.invalidateData();
                return result;
            },
            deferOnboarding: async () => {
                await this.plugin.deferOnboarding();
                this.invalidateData();
            },
            resumeOnboarding: async () => {
                await this.plugin.resumeOnboarding();
                this.invalidateData();
            },
            setReviewState: async (journalPath, anchorDate, activeTab) => {
                this.viewState.journalPath = journalPath;
                this.viewState.anchorDate = anchorDate;
                this.viewState.activeTab = activeTab;
                await this.plugin.setReviewState(journalPath, anchorDate, activeTab);
            },
            activateJournalTab: async (journalPath, activeTab) => {
                await this.plugin.activateReviewView(journalPath, undefined, activeTab);
            },
            createEntry: async () => {
                const journals = [...this.plugin.journals];
                if (journals.length === 0) {
                    return;
                }

                const onlyJournal = journals[0];
                if (journals.length === 1 && onlyJournal) {
                    await this.createJournalEntry(onlyJournal.path);
                    return;
                }

                new NewEntryJournalModal(this.app, journals, journal => {
                    void this.createJournalEntry(journal.path);
                }).open();
            },
            createJournal: async () => {
                new NewJournalModal(this.app, async journalName => {
                    const result = await this.plugin.createJournal(journalName);
                    if (result.ok) {
                        this.syncStateFromPlugin();
                        this.invalidateData();
                    }
                    return result;
                }).open();
            },
            createJournalEntry: async (journalPath, date) => {
                await this.createJournalEntry(journalPath, date);
            },
            openSettings: async () => {
                this.plugin.openSettings();
            },
            openNote: async (filePath) => {
                await this.openReviewedNote(filePath);
            },
            createSynthesisNote: async (journalPath, anchorDate, periodType) => {
                await this.plugin.createSynthesisNote(journalPath, anchorDate, periodType);
                this.invalidateData();
            },
            updateRemindersEnabled: async (enabled) => {
                await this.plugin.updateRemindersEnabled(enabled);
                this.invalidateData();
            },
            updateOsNotificationsEnabled: async (enabled) => {
                await this.plugin.updateOsNotificationsEnabled(enabled);
                this.invalidateData();
            },
            requestNotificationPermission: async () => {
                await this.plugin.requestNotificationPermission();
                this.invalidateData();
            },
            sendTestReminderNotification: async () => {
                await this.plugin.sendTestReminderNotification();
            },
            updateJournalReminderSettings: async (journalPath, settings) => {
                await this.plugin.updateJournalReminderSettings(journalPath, settings);
                this.invalidateData();
            },
        };
    }

    private onReviewDataChanged() {
        this.plugin.refreshJournals();
        this.syncStateFromPlugin();
        this.invalidateData();
    }

    private syncStateFromPlugin() {
        const reviewState = this.plugin.getReviewState();
        this.viewState.journalPath = reviewState.journalPath ?? this.plugin.getDefaultReviewJournalPath();
        this.viewState.anchorDate = reviewState.anchorDate;
        this.viewState.activeTab = reviewState.activeTab;
    }

    private invalidateData() {
        this.viewState.revision += 1;
    }

    private async createJournalEntry(journalPath: string, date?: string) {
        const journal = this.plugin.getJournalByPath(journalPath);
        if (!journal) {
            return;
        }

        await this.plugin.createJournalEntry(journal, date);
        this.invalidateData();
    }

    private async openReviewedNote(filePath: string) {
        const targetFile = this.app.vault.getFileByPath(filePath);
        if (!targetFile) {
            return;
        }

        const mostRecentLeaf = this.app.workspace.getMostRecentLeaf();
        if (mostRecentLeaf && mostRecentLeaf.view.getViewType() !== VIEW_TYPE_REVIEW) {
            await mostRecentLeaf.openFile(targetFile);
            return;
        }

        await this.app.workspace.getLeaf(true).openFile(targetFile);
    }
}
