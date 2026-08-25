import { Notice, Plugin, TAbstractFile, TFile, TFolder, normalizePath, WorkspaceLeaf, parseYaml } from 'obsidian';
import moment from 'moment';
import '../styles-vite.css';
import {
    type BasesGenerationTarget,
    buildEntryBaseContents,
    buildJournalystNoteProperties,
    buildReflectionBaseContents,
    getFrontmatterPropertyDiff,
    getJournalystBaseFileName,
    JOURNALYST_BASE_MANAGED_PROPERTIES,
    type JournalBaseResource,
    type JournalBasesIntegrationModel,
    type JournalNotePropertyBackfillItem,
    type ParsedJournalystNoteKind,
    type JournalystEntryType,
    parseJournalystNoteKind,
    upsertFrontmatterProperties,
} from "../bases";
import {
    type JournalCadenceConfig,
    type JournalCadenceRevision,
    type JournalSchedulePause,
    createJournalCadenceSchedule,
    getCadenceForDate,
    getCurrentJournalCadence,
    normalizeJournalCadence,
    normalizeJournalCadenceTimeline,
    normalizeJournalSchedulePauses,
} from "../cadence";
import { hashJournalEntryBody } from "../entryCompletion";
import {
    type JournalAutosaveResult,
    type JournalAutosaveSection,
    type JournalAutosaveUndoResult,
    type JournalAutosaveValue,
    type JournalEntrySetupUpdate,
    type JournalPromptPreviewModel,
    type JournalSettingsActionResult,
    type JournalSettingsSection,
    type JournalSettingsViewModel,
    type JournalSchedulePauseActionResult,
    type JournalSchedulePauseUpdate,
} from "../journalSettings";
import {
    DEFAULT_ONBOARDING_ROOT,
    JOURNALYST_ONBOARDING_VERSION,
    type CompleteOnboardingRequest,
    type CompleteOnboardingResult,
    type JournalystOnboardingSettings,
    type OnboardingViewModel,
    createPendingOnboardingSettings,
    isCurrentOnboardingSettings,
    normalizeOnboardingSettings,
} from "../onboarding";
import { BUILT_IN_PROMPT_LISTS } from "../promptLibrary";
import {
    createCustomPromptListDefinition,
    createPromptBlock,
    createPromptOutputPreview,
    getPromptSourceKey,
    getPromptSourceSelection,
    getPromptTemplateContext,
    type JournalPromptHistory,
    type JournalPromptSettings,
    normalizeJournalPromptSettings,
    normalizeJournalPromptHistory,
    type PromptListDefinition,
    type ResolvedPrompt,
    resolvePromptForJournal,
    resolvePromptList,
    resolvePromptOptionById,
    resolvePromptPreview,
} from "../prompts";
import {
    buildReminderHistoryKey,
    buildSynthesisReminderFileName,
    getReminderEventsForJournal,
    hasAnyEnabledReminder,
    isWithinReminderQuietHours,
    type JournalReminderSettings,
    normalizeJournalReminderSettings,
    normalizeReminderQuietHours,
    type ReminderQuietHoursSettings,
    type ReminderOccurrenceRecord,
    type ResolvedReminderEvent,
    type ReviewReminderPeriod,
} from "../reminders";
import { buildSynthesisNotePreview } from "../review/buildSnapshot";
import { type ReviewWorkspaceTab, type SidebarMode, type SynthesisPeriodType } from "../review/types";
import { createTemplateStrategies } from "../templates/strategies";
import {
    buildJournalMigrationPlan,
    findJournalEntryFile,
    formatJournalNoteBaseName,
    formatJournalNoteFileName,
    type JournalNoteMigrationItem,
    parseJournalDateFromFile,
} from "../journalNaming";
import {
    type CoreTemplatesSettings,
    type JournalTemplateEngineStrategy,
    type ObsidianInternalPlugins,
    type ObsidianPlugins,
    type TemplateAvailability,
    type TemplateEngine,
    type TemplateFailureBehavior,
    type TemplaterPlugin,
    type TemplatePromptContext,
} from "../templates/types";
import { ReviewView, VIEW_TYPE_REVIEW } from "../views/Review";
import { SideBarView, VIEW_TYPE_SIDE_BAR } from "../views/SideBar";
import { JournalystSettingsTab } from "../views/Settings";

export interface JournalystPluginSettings {
    rootDirectory: string | null;
    onboarding: JournalystOnboardingSettings;
    basesIntegrationEnabled: boolean;
    remindersEnabled: boolean;
    osNotificationsEnabled: boolean;
    reminderQuietHours: ReminderQuietHoursSettings;
    sidebarMode: SidebarMode;
    noteDateFormat: string;
    noteDateFormatHistory: string[];
    journalCadenceRevisions: Record<string, JournalCadenceRevision[]>;
    journalSchedulePauses: Record<string, JournalSchedulePause[]>;
    journalCadences?: Record<string, JournalCadenceConfig>;
    customPromptLists: Record<string, PromptListDefinition>;
    journalPromptSettings: Record<string, JournalPromptSettings>;
    journalPromptHistory: Record<string, JournalPromptHistory>;
    journalReminderSettings: Record<string, JournalReminderSettings>;
    reminderHistory: Record<string, ReminderOccurrenceRecord>;
    journalEntryBaselines: Record<string, string>;
    templateEngine: TemplateEngine;
    templateFailureBehavior: TemplateFailureBehavior;
    templaterJournalTemplates: Record<string, string>;
    coreJournalTemplates: Record<string, string>;
    journalTemplates?: Record<string, string>;
}

interface JournalReminderHistorySnapshot {
    records: Record<string, ReminderOccurrenceRecord>;
}

interface JournalScheduleUndoSnapshot extends JournalReminderHistorySnapshot {
    hadTimeline: boolean;
    timeline: JournalCadenceRevision[];
}

interface JournalEntrySetupUndoSnapshot {
    templateEngine: TemplateEngine;
    hadTemplatePath: boolean;
    templatePath: string | null;
    hadPromptSettings: boolean;
    promptSettings: JournalPromptSettings;
    hadPromptHistory: boolean;
    promptHistory: JournalPromptHistory | null;
}

interface JournalReminderUndoSnapshot extends JournalReminderHistorySnapshot {
    hadSettings: boolean;
    settings: JournalReminderSettings;
}

type JournalSettingsUndoRecord = {
    token: string;
    journalPath: string;
    section: 'schedule';
    before: JournalScheduleUndoSnapshot;
    after: JournalScheduleUndoSnapshot;
} | {
    token: string;
    journalPath: string;
    section: 'entry-setup';
    before: JournalEntrySetupUndoSnapshot;
    after: JournalEntrySetupUndoSnapshot;
} | {
    token: string;
    journalPath: string;
    section: 'reminders';
    before: JournalReminderUndoSnapshot;
    after: JournalReminderUndoSnapshot;
};

type WithoutUndoToken<T> = T extends unknown ? Omit<T, 'token'> : never;
type JournalSettingsUndoInput = WithoutUndoToken<JournalSettingsUndoRecord>;

const DEFAULT_SETTINGS: JournalystPluginSettings = {
	rootDirectory: null,
    onboarding: createPendingOnboardingSettings(),
    basesIntegrationEnabled: false,
    remindersEnabled: false,
    osNotificationsEnabled: false,
    reminderQuietHours: normalizeReminderQuietHours(),
    sidebarMode: 'journals-mini',
    noteDateFormat: 'YYYY-MM-DD',
    noteDateFormatHistory: [],
    journalCadenceRevisions: {},
    journalSchedulePauses: {},
    customPromptLists: {},
    journalPromptSettings: {},
    journalPromptHistory: {},
    journalReminderSettings: {},
    reminderHistory: {},
    journalEntryBaselines: {},
    templateEngine: 'templater',
    templateFailureBehavior: 'fallback-default',
    templaterJournalTemplates: {},
    coreJournalTemplates: {},
}


export default class JournalystPlugin extends Plugin {
	settings!: JournalystPluginSettings;
    journals: TFolder[] = [];
    private journalCommandIds: string[] = [];
    // Strategy instances keep engine-specific behavior out of the main plugin flow.
    private templateStrategies!: Partial<Record<Exclude<TemplateEngine, 'none'>, JournalTemplateEngineStrategy>>;
    private lastReminderCheckMinute: string | null = null;
    private readonly entryCompletionByPath = new Map<string, boolean>();
    private readonly entryCompletionRevisions = new Map<string, number>();
    private journalSettingsUndo: JournalSettingsUndoRecord | null = null;
    private onboardingNeedsMigration = false;
    private hadStoredRootDirectory = false;
    private reviewState: {
        journalPath: string | null;
        anchorDate: string;
        activeTab: ReviewWorkspaceTab;
        journalSettingsSection: JournalSettingsSection;
    } = {
        journalPath: null,
        anchorDate: moment().format('YYYY-MM-DD'),
        activeTab: 'home',
        journalSettingsSection: 'schedule',
    };

	async onload() {
		await this.loadSettings();
        await this.initializeEntryCompletionCache();
        this.initializeTemplateStrategies();
        this.addSettingTab(new JournalystSettingsTab(this.app, this));

		this.addRibbonIcon('notebook-pen', 'Go to Journalyst view', () => {
            this.activateView();
        });
        this.addRibbonIcon('notebook', 'Open Journalyst sidebar', () => {
            this.activateSidebarView();
        });

        this.app.workspace.onLayoutReady(() => {
            void this.initializeWorkspaceLayout();
        })

        if (typeof window !== 'undefined') {
            this.registerInterval(window.setInterval(() => {
                void this.checkReminderNotifications();
            }, 60_000));
        }

        this.addCommand({
            id: 'open-journalyst-review',
            name: 'Open Journalyst review',
            callback: () => {
                this.activateReviewView(undefined, undefined, 'review');
            }
        });

        this.addCommand({
            id: 'open-journalyst-journals',
            name: 'Manage Journalyst journals',
            callback: () => {
                void this.activateJournalSettings();
            }
        });

        this.addCommand({
            id: 'open-journalyst-sidebar',
            name: 'Open Journalyst sidebar',
            callback: () => {
                this.activateSidebarView();
            }
        });

        this.addCommand({
            id: 'open-journalyst-analytics',
            name: 'Open Journalyst analytics',
            callback: () => {
                this.activateReviewView(undefined, undefined, 'analytics');
            }
        });

        this.addCommand({
            id: 'open-journalyst-synthesis',
            name: 'Open Journalyst synthesis',
            callback: () => {
                this.activateReviewView(undefined, undefined, 'synthesis');
            }
        });

        this.addCommand({
            id: 'open-journalyst-reminders',
            name: 'Open Journalyst reminder settings',
            callback: () => {
                const journal = this.inferCurrentJournal()
                    ?? this.getJournalByPath(this.reviewState.journalPath ?? '')
                    ?? this.journals[0];

                if (journal) {
                    void this.activateJournalSettings(journal.path, 'reminders');
                    return;
                }

                this.openSettings();
            }
        });

        this.addCommand({
            id: 'open-journalyst-review-current-journal',
            name: 'Open review for current journal',
            callback: () => {
                const journal = this.inferCurrentJournal();

                if (!journal) {
                    new Notice('Journalyst could not infer a journal from the current note.');
                    return;
                }

                this.activateReviewView(journal.path);
            }
        });

        this.addCommand({
            id: 'generate-bases-for-current-journal',
            name: 'Generate Bases for current journal',
            callback: async () => {
                const journal = this.inferCurrentJournal() ?? this.getJournalByPath(this.getDefaultReviewJournalPath() ?? '');

                if (!journal) {
                    new Notice('Journalyst could not find a journal to generate Bases for.');
                    return;
                }

                await this.generateBasesForJournal(journal);
            }
        });

        this.addCommand({
            id: 'generate-bases-for-all-journals',
            name: 'Generate Bases for all journals',
            callback: async () => {
                await this.generateBasesForAllJournals();
            }
        });

        this.registerEvent(
            this.app.vault.on('create', () => {
                void this.onItemChange();
            })
        );
        this.registerEvent(
            this.app.vault.on('delete', (item) => {
                void this.onItemDelete(item);
            })
        );
        this.registerEvent(
            this.app.vault.on('rename', (item, oldPath) => {
                void this.onItemRename(item, oldPath);
            })
        );
        this.registerEvent(
            this.app.vault.on('modify', (item) => {
                void this.onItemModify(item);
            })
        );
    };

	onunload() {}

    private async onItemChange() {
        this.refreshJournals();
        try {
            await this.reconcileJournalCadenceTimelines();
        } catch (error) {
            console.error('Journalyst could not initialize cadence history for a new journal.', error);
        }
        this.refreshReviewViews();
    }

    private async initializeWorkspaceLayout() {
        this.refreshJournals();

        try {
            await this.reconcileOnboardingAfterLoad();
        } catch (error) {
            console.error('Journalyst could not reconcile onboarding state.', error);
        }

        this.refreshJournals();
        try {
            await this.reconcileJournalCadenceTimelines();
        } catch (error) {
            console.error('Journalyst could not persist cadence history during startup.', error);
        }

        this.registerView(
            VIEW_TYPE_SIDE_BAR,
            (leaf) => new SideBarView(leaf, this)
        );
        this.registerView(
            VIEW_TYPE_REVIEW,
            (leaf) => new ReviewView(leaf, this)
        );

        void this.checkReminderNotifications();
    }

    private async onItemRename(item: TAbstractFile, oldPath: string) {
        const completionPathChanged = this.remapEntryCompletionPaths(oldPath, item.path, item instanceof TFolder);

        if (item instanceof TFolder) {
            this.remapJournalPaths(oldPath, item.path);
            await this.saveSettings();
        } else if (completionPathChanged) {
            await this.saveSettings();
        }

        this.refreshJournals();
        if (completionPathChanged) {
            this.refreshCompletionViews();
        }
    }

    private async onItemDelete(item: TAbstractFile) {
        const completionPathRemoved = this.removeEntryCompletionPaths(item.path, item instanceof TFolder);
        this.refreshJournals();

        if (completionPathRemoved) {
            await this.saveSettings();
            this.refreshCompletionViews();
        }
    }

    private async onItemModify(item: TAbstractFile) {
        if (!(item instanceof TFile) || !this.settings.journalEntryBaselines[item.path]) {
            return;
        }

        const revision = (this.entryCompletionRevisions.get(item.path) ?? 0) + 1;
        this.entryCompletionRevisions.set(item.path, revision);

        try {
            const contents = await this.app.vault.read(item);
            const currentHash = await hashJournalEntryBody(contents);

            if (this.entryCompletionRevisions.get(item.path) !== revision) {
                return;
            }

            const isComplete = currentHash !== this.settings.journalEntryBaselines[item.path];
            if (this.entryCompletionByPath.get(item.path) === isComplete) {
                return;
            }

            this.entryCompletionByPath.set(item.path, isComplete);
            this.refreshCompletionViews();
        } catch (error) {
            console.error(`Journalyst could not evaluate completion for "${item.path}".`, error);
        }
    }

    refreshJournals() {
        // Journal commands are derived from folders under the configured root, so
        // rebuild them whenever the root changes or the vault structure changes.
        this.journalCommandIds.forEach(commandId => this.removeCommand(commandId));
        this.journalCommandIds = [];
        this.journals = [];

        if (this.settings.onboarding.status !== 'completed') {
            return;
        }

        const rootFolder = this.getConfiguredRootFolder();
        if (!rootFolder) {
            return;
        }

        rootFolder.children.forEach((child, index) => {
            if (!(child instanceof TFolder)) {
                return;
            }

            this.journals.push(child);
            this.addJournalCommand(child, index);
        })

        if (!this.reviewState.journalPath || !this.getJournalByPath(this.reviewState.journalPath)) {
            this.reviewState.journalPath = this.getDefaultReviewJournalPath();
        }
    }

    private async reconcileJournalCadenceTimelines(persist = true) {
        let changed = false;

        for (const journal of this.journals) {
            const normalizedTimeline = normalizeJournalCadenceTimeline(this.settings.journalCadenceRevisions[journal.path]);
            if (normalizedTimeline.length > 0) {
                if (JSON.stringify(normalizedTimeline) !== JSON.stringify(this.settings.journalCadenceRevisions[journal.path])) {
                    this.settings.journalCadenceRevisions[journal.path] = normalizedTimeline;
                    changed = true;
                }
                continue;
            }

            const entryDates = journal.children
                .map(child => this.parseJournalDateFromFile(child))
                .filter((date): date is string => !!date)
                .sort();
            this.settings.journalCadenceRevisions[journal.path] = [{
                effectiveFrom: entryDates[0] ?? moment().format('YYYY-MM-DD'),
                cadence: normalizeJournalCadence(this.settings.journalCadences?.[journal.path]),
            }];
            if (this.settings.journalCadences?.[journal.path]) {
                delete this.settings.journalCadences[journal.path];
            }
            changed = true;
        }

        if (changed && persist) {
            await this.saveSettings();
        }
    }

    getOnboardingViewModel(): OnboardingViewModel {
        const root = this.app.vault.getRoot();
        const folderOptions = [root, ...this.app.vault.getAllLoadedFiles()
            .filter((file): file is TFolder => file instanceof TFolder && file.path !== root.path)]
            .map(folder => ({
                path: folder === root ? '/' : folder.path,
                name: folder === root ? 'Vault root' : folder.path,
                journalCount: this.getJournalFolders(folder).length,
            }))
            .sort((left, right) => {
                if (left.path === '/') return -1;
                if (right.path === '/') return 1;
                return left.path.localeCompare(right.path, undefined, { sensitivity: 'base' });
            });

        return {
            status: this.settings.onboarding.status,
            configuredRootPath: this.settings.rootDirectory,
            suggestedRootPath: this.settings.rootDirectory || DEFAULT_ONBOARDING_ROOT,
            folderOptions,
        };
    }

    async updateRootDirectory(rootPath: string | null): Promise<CompleteOnboardingResult> {
        const previousRootPath = this.settings.rootDirectory;
        const previousOnboarding = this.settings.onboarding;

        if (rootPath === null) {
            this.settings.rootDirectory = null;
            this.refreshJournals();
            try {
                await this.saveSettings();
                this.refreshReviewViews();
                return { ok: true };
            } catch (error) {
                this.settings.rootDirectory = previousRootPath;
                this.refreshJournals();
                return {
                    ok: false,
                    error: error instanceof Error ? error.message : 'Journalyst could not save the home directory.',
                };
            }
        }

        const validation = this.validateRootPath(rootPath);
        if (!validation.ok) {
            return validation;
        }

        const rootFolder = this.getConfiguredRootFolder(validation.path);
        if (!rootFolder) {
            return { ok: false, error: 'Choose a folder that currently exists in the vault.' };
        }

        this.settings.rootDirectory = validation.path;
        if (this.settings.onboarding.status !== 'completed' && this.getJournalFolders(rootFolder).length > 0) {
            this.settings.onboarding = {
                version: JOURNALYST_ONBOARDING_VERSION,
                status: 'completed',
            };
        }
        this.refreshJournals();
        await this.reconcileJournalCadenceTimelines(false);

        try {
            await this.saveSettings();
            this.refreshReviewViews();
            return { ok: true };
        } catch (error) {
            this.settings.rootDirectory = previousRootPath;
            this.settings.onboarding = previousOnboarding;
            this.refreshJournals();
            return {
                ok: false,
                error: error instanceof Error ? error.message : 'Journalyst could not save the home directory.',
            };
        }
    }

    async createJournal(journalName: string): Promise<CompleteOnboardingResult> {
        const rootFolder = this.getConfiguredRootFolder();
        if (!rootFolder) {
            return { ok: false, error: 'Choose a valid Journalyst home directory before creating a journal.' };
        }

        const validation = this.validateJournalNames([journalName]);
        if (!validation.ok) {
            return validation;
        }

        const normalizedName = validation.names[0];
        if (!normalizedName) {
            return { ok: false, error: 'Enter a journal name.' };
        }

        const existingChild = this.findChildByName(rootFolder, normalizedName);
        if (existingChild instanceof TFolder) {
            return { ok: false, error: `A journal named "${existingChild.name}" already exists.` };
        }
        if (existingChild instanceof TFile) {
            return { ok: false, error: `A file named "${existingChild.name}" already exists in ${rootFolder.path}.` };
        }

        const journalPath = this.getChildPath(rootFolder, normalizedName);
        try {
            await this.app.vault.createFolder(journalPath);
            this.refreshJournals();
            this.settings.journalCadenceRevisions[journalPath] = [{
                effectiveFrom: moment().format('YYYY-MM-DD'),
                cadence: normalizeJournalCadence(null),
            }];
            this.reviewState = {
                journalPath,
                anchorDate: this.reviewState.anchorDate,
                activeTab: 'home',
                journalSettingsSection: 'schedule',
            };
            await this.saveSettings();
            this.refreshReviewViews();
            return { ok: true };
        } catch (error) {
            this.refreshJournals();
            console.error('Journalyst could not create the journal.', error);
            return {
                ok: false,
                error: error instanceof Error
                    ? `Journalyst could not create the journal: ${error.message}`
                    : 'Journalyst could not create the journal. Try again.',
            };
        }
    }

    openSettings() {
        const app = this.app as typeof this.app & {
            setting?: {
                open(): void;
                openTabById(id: string): void;
            };
        };

        if (!app.setting) {
            new Notice('Journalyst could not open Obsidian settings.');
            return;
        }

        app.setting.open();
        app.setting.openTabById(this.manifest.id);
    }

    openCorePluginsSettings() {
        const app = this.app as typeof this.app & {
            setting?: {
                open(): void;
                openTabById(id: string): void;
            };
        };

        if (!app.setting) {
            new Notice('Journalyst could not open Obsidian settings.');
            return;
        }

        app.setting.open();
        app.setting.openTabById('core-plugins');
    }

    async completeOnboarding(request: CompleteOnboardingRequest): Promise<CompleteOnboardingResult> {
        const previousRootPath = this.settings.rootDirectory;
        const previousOnboarding = this.settings.onboarding;
        const previousReviewState = { ...this.reviewState };
        const rootValidation = this.validateRootPath(request.rootPath);
        if (!rootValidation.ok) {
            return rootValidation;
        }

        const journalValidation = this.validateJournalNames(request.journalNames);
        if (!journalValidation.ok) {
            return journalValidation;
        }

        const rootConflict = this.findRootPathConflict(rootValidation.path);
        if (rootConflict) {
            return { ok: false, error: rootConflict };
        }

        const existingRoot = this.findExistingRootFolder(rootValidation.path);
        const existingJournals = existingRoot ? this.getJournalFolders(existingRoot) : [];
        if (journalValidation.names.length === 0 && existingJournals.length === 0) {
            return {
                ok: false,
                error: 'Select at least one journal, or choose a folder that already contains journal folders.',
            };
        }

        if (existingRoot) {
            const journalConflict = this.findJournalPathConflict(existingRoot, journalValidation.names);
            if (journalConflict) {
                return { ok: false, error: journalConflict };
            }
        }

        try {
            const rootFolder = await this.ensureRootFolder(rootValidation.path);
            const journalConflict = this.findJournalPathConflict(rootFolder, journalValidation.names);
            if (journalConflict) {
                return { ok: false, error: journalConflict };
            }

            for (const journalName of journalValidation.names) {
                const existingChild = this.findChildByName(rootFolder, journalName);
                if (existingChild instanceof TFolder) {
                    continue;
                }

                await this.app.vault.createFolder(this.getChildPath(rootFolder, journalName));
            }

            this.settings.rootDirectory = rootFolder === this.app.vault.getRoot() ? '/' : rootFolder.path;
            this.settings.onboarding = {
                version: JOURNALYST_ONBOARDING_VERSION,
                status: 'completed',
            };
            this.refreshJournals();
            await this.reconcileJournalCadenceTimelines(false);
            this.reviewState = {
                journalPath: this.getDefaultReviewJournalPath(),
                anchorDate: this.reviewState.anchorDate,
                activeTab: 'home',
                journalSettingsSection: 'schedule',
            };
            await this.saveSettings();
            this.refreshReviewViews();
            return { ok: true };
        } catch (error) {
            this.settings.rootDirectory = previousRootPath;
            this.settings.onboarding = previousOnboarding;
            this.reviewState = previousReviewState;
            this.refreshJournals();
            this.refreshReviewViews();
            console.error('Journalyst could not complete onboarding.', error);
            return {
                ok: false,
                error: error instanceof Error
                    ? `Journalyst could not create the folders: ${error.message}`
                    : 'Journalyst could not create the folders. Check the paths and try again.',
            };
        }
    }

    async deferOnboarding() {
        if (this.settings.onboarding.status === 'completed') {
            return;
        }

        const previousOnboarding = this.settings.onboarding;
        this.settings.onboarding = {
            version: JOURNALYST_ONBOARDING_VERSION,
            status: 'deferred',
        };
        try {
            await this.saveSettings();
            this.refreshReviewViews();
        } catch (error) {
            this.settings.onboarding = previousOnboarding;
            throw error;
        }
    }

    async resumeOnboarding() {
        if (this.settings.onboarding.status === 'completed') {
            return;
        }

        const previousOnboarding = this.settings.onboarding;
        this.settings.onboarding = {
            version: JOURNALYST_ONBOARDING_VERSION,
            status: 'pending',
        };
        try {
            await this.saveSettings();
            this.refreshReviewViews();
        } catch (error) {
            this.settings.onboarding = previousOnboarding;
            throw error;
        }
    }

    private async reconcileOnboardingAfterLoad() {
        if (!this.onboardingNeedsMigration) {
            return;
        }

        let configuredRootPath = this.settings.rootDirectory;
        let hasUsableLegacySetup = false;

        if (this.hadStoredRootDirectory) {
            if (configuredRootPath) {
                const configuredRoot = this.getConfiguredRootFolder(configuredRootPath);
                hasUsableLegacySetup = configuredRootPath === '/'
                    ? !!configuredRoot && this.hasLegacyEntryEvidence(configuredRoot)
                    : !!configuredRoot && this.getJournalFolders(configuredRoot).length > 0;
            }
        } else {
            const vaultRoot = this.app.vault.getRoot();
            if (this.hasLegacyEntryEvidence(vaultRoot)) {
                configuredRootPath = '/';
                hasUsableLegacySetup = true;
            }
        }

        this.settings.rootDirectory = configuredRootPath;
        this.settings.onboarding = {
            version: JOURNALYST_ONBOARDING_VERSION,
            status: hasUsableLegacySetup ? 'completed' : 'pending',
        };
        this.onboardingNeedsMigration = false;
        await this.saveSettings();
    }

    private getConfiguredRootFolder(rootPath = this.settings.rootDirectory) {
        if (!rootPath) {
            return null;
        }

        if (rootPath === '/') {
            return this.app.vault.getRoot();
        }

        return this.app.vault.getFolderByPath(normalizePath(rootPath));
    }

    private findExistingRootFolder(rootPath: string) {
        if (rootPath === '/') {
            return this.app.vault.getRoot();
        }

        let currentFolder = this.app.vault.getRoot();
        for (const segment of rootPath.split('/')) {
            const child = this.findChildByName(currentFolder, segment);
            if (!(child instanceof TFolder)) {
                return null;
            }
            currentFolder = child;
        }

        return currentFolder;
    }

    private getJournalFolders(rootFolder: TFolder) {
        return rootFolder.children.filter((child): child is TFolder => child instanceof TFolder);
    }

    private hasLegacyEntryEvidence(rootFolder: TFolder) {
        return this.getJournalFolders(rootFolder).some(journal =>
            journal.children.some(child => child instanceof TFile && !!this.parseJournalDateFromFile(child))
        );
    }

    private validateRootPath(rootPath: string):
        | { ok: true; path: string }
        | { ok: false; error: string } {
        const trimmedPath = rootPath.trim();
        if (trimmedPath === '/') {
            return { ok: true, path: '/' };
        }

        if (!trimmedPath) {
            return { ok: false, error: 'Enter a vault-relative folder path.' };
        }

        if (trimmedPath.includes('\\')) {
            return { ok: false, error: 'Use forward slashes in folder paths.' };
        }

        const segments = trimmedPath.split('/').map(segment => segment.trim());
        if (segments.some(segment => !segment || segment === '.' || segment === '..')) {
            return { ok: false, error: 'Use a vault-relative path without empty, . or .. segments.' };
        }

        const invalidSegment = segments.find(segment => this.hasInvalidFileNameCharacters(segment));
        if (invalidSegment) {
            return { ok: false, error: `The folder name "${invalidSegment}" contains unsupported characters.` };
        }

        return { ok: true, path: normalizePath(segments.join('/')) };
    }

    private validateJournalNames(journalNames: string[]):
        | { ok: true; names: string[] }
        | { ok: false; error: string } {
        const names: string[] = [];
        const seenNames = new Set<string>();

        for (const rawName of journalNames) {
            const name = rawName.trim();
            if (!name) {
                continue;
            }

            if (name === '.' || name === '..' || this.hasInvalidFileNameCharacters(name)) {
                return { ok: false, error: `The journal name "${name}" contains unsupported characters.` };
            }

            const comparisonName = name.toLocaleLowerCase();
            if (seenNames.has(comparisonName)) {
                continue;
            }

            seenNames.add(comparisonName);
            names.push(name);
        }

        return { ok: true, names };
    }

    private hasInvalidFileNameCharacters(name: string) {
        const hasControlCharacter = Array.from(name).some(character => character.charCodeAt(0) < 32);
        return hasControlCharacter || /[\\/:*?"<>|]/.test(name) || /[. ]$/.test(name);
    }

    private findRootPathConflict(rootPath: string) {
        if (rootPath === '/') {
            return null;
        }

        let currentFolder = this.app.vault.getRoot();
        for (const segment of rootPath.split('/')) {
            const child = this.findChildByName(currentFolder, segment);
            if (child instanceof TFile) {
                return `A file named "${child.name}" already blocks that folder path.`;
            }
            if (!(child instanceof TFolder)) {
                return null;
            }
            currentFolder = child;
        }

        return null;
    }

    private findJournalPathConflict(rootFolder: TFolder, journalNames: string[]) {
        for (const journalName of journalNames) {
            const child = this.findChildByName(rootFolder, journalName);
            if (child instanceof TFile) {
                return `A file named "${child.name}" already exists in ${rootFolder.path}.`;
            }
        }

        return null;
    }

    private async ensureRootFolder(rootPath: string) {
        if (rootPath === '/') {
            return this.app.vault.getRoot();
        }

        let currentFolder = this.app.vault.getRoot();
        for (const segment of rootPath.split('/')) {
            const existingChild = this.findChildByName(currentFolder, segment);
            if (existingChild instanceof TFile) {
                throw new Error(`A file named "${existingChild.name}" blocks the folder path.`);
            }
            if (existingChild instanceof TFolder) {
                currentFolder = existingChild;
                continue;
            }

            const nextPath = this.getChildPath(currentFolder, segment);
            await this.app.vault.createFolder(nextPath);
            const createdFolder = this.app.vault.getFolderByPath(nextPath);
            if (!createdFolder) {
                throw new Error(`The folder "${nextPath}" was not available after creation.`);
            }
            currentFolder = createdFolder;
        }

        return currentFolder;
    }

    private findChildByName(folder: TFolder, name: string) {
        const comparisonName = name.toLocaleLowerCase();
        return folder.children.find(child => child.name.toLocaleLowerCase() === comparisonName) ?? null;
    }

    private getChildPath(folder: TFolder, childName: string) {
        return normalizePath([folder === this.app.vault.getRoot() ? '' : folder.path, childName]
            .filter(Boolean)
            .join('/'));
    }

    private refreshReviewViews() {
        this.app.workspace.getLeavesOfType(VIEW_TYPE_REVIEW).forEach(leaf => {
            if (leaf.view instanceof ReviewView) {
                leaf.view.updateReviewState(
                    this.reviewState.journalPath,
                    this.reviewState.anchorDate,
                    this.reviewState.activeTab,
                );
            }
        });
    }

    private refreshCompletionViews() {
        this.refreshReviewViews();
        this.refreshSidebarView();
    }

    private async initializeEntryCompletionCache() {
        this.entryCompletionByPath.clear();
        let settingsChanged = false;

        await Promise.all(Object.entries(this.settings.journalEntryBaselines).map(async ([filePath, baselineHash]) => {
            const file = this.app.vault.getFileByPath(filePath);
            if (!file) {
                delete this.settings.journalEntryBaselines[filePath];
                settingsChanged = true;
                return;
            }

            try {
                const contents = await this.app.vault.read(file);
                const currentHash = await hashJournalEntryBody(contents);
                this.entryCompletionByPath.set(filePath, currentHash !== baselineHash);
            } catch (error) {
                this.entryCompletionByPath.set(filePath, false);
                console.error(`Journalyst could not initialize completion for "${filePath}".`, error);
            }
        }));

        if (settingsChanged) {
            await this.saveSettings();
        }
    }

    private async captureJournalEntryBaseline(file: TFile) {
        try {
            const contents = await this.app.vault.read(file);
            const baselineHash = await hashJournalEntryBody(contents);
            this.settings.journalEntryBaselines[file.path] = baselineHash;
            this.entryCompletionByPath.set(file.path, false);
            this.entryCompletionRevisions.delete(file.path);
            await this.saveSettings();
            this.refreshCompletionViews();
        } catch (error) {
            delete this.settings.journalEntryBaselines[file.path];
            this.entryCompletionByPath.delete(file.path);
            this.entryCompletionRevisions.delete(file.path);
            console.error(`Journalyst could not track completion for "${file.path}".`, error);
            new Notice('Journalyst created the entry but could not track whether its generated content has changed.');
        }
    }

    private remapEntryCompletionPaths(oldPath: string, newPath: string, includeDescendants: boolean) {
        const pathPrefix = oldPath + '/';
        const matchesPath = (filePath: string) => filePath === oldPath
            || (includeDescendants && filePath.startsWith(pathPrefix));
        let changed = false;

        Object.entries(this.settings.journalEntryBaselines).forEach(([filePath, baselineHash]) => {
            if (!matchesPath(filePath)) {
                return;
            }

            const nextPath = newPath + filePath.slice(oldPath.length);
            delete this.settings.journalEntryBaselines[filePath];
            this.settings.journalEntryBaselines[nextPath] = baselineHash;

            const completion = this.entryCompletionByPath.get(filePath);
            this.entryCompletionByPath.delete(filePath);
            if (completion !== undefined) {
                this.entryCompletionByPath.set(nextPath, completion);
            }

            this.entryCompletionRevisions.delete(filePath);
            changed = true;
        });

        return changed;
    }

    private removeEntryCompletionPaths(path: string, includeDescendants: boolean) {
        const pathPrefix = path + '/';
        const pathsToRemove = Object.keys(this.settings.journalEntryBaselines)
            .filter(filePath => filePath === path || (includeDescendants && filePath.startsWith(pathPrefix)));

        pathsToRemove.forEach(filePath => {
            delete this.settings.journalEntryBaselines[filePath];
            this.entryCompletionByPath.delete(filePath);
            this.entryCompletionRevisions.delete(filePath);
        });

        return pathsToRemove.length > 0;
    }

    isJournalEntryComplete(file: TFile) {
        if (!this.settings.journalEntryBaselines[file.path]) {
            return true;
        }

        return this.entryCompletionByPath.get(file.path) ?? false;
    }

    private addJournalCommand(journal: TFolder, index: number) {
        const commandId = 'create-journal-' + index + '-' + journal.path.replace(/[^a-zA-Z0-9-]/g, '-');
        this.journalCommandIds.push(commandId);

        this.addCommand({
            id: commandId,
            name: "Create today's entry in " + journal.name,
            callback: () => {
                this.createJournalEntry(journal);
            }
        })
    }

    async createJournalEntry(journalFolder: TFolder, date = moment().format('YYYY-MM-DD')) {
        const newFileName = this.formatJournalNoteFileName(date);
        const fullPath = normalizePath(journalFolder.path + '/' + newFileName);
        const existingFile = this.findJournalEntryFile(journalFolder, date);

        if (existingFile instanceof TFile) {
            await this.app.workspace.openLinkText(existingFile.path, '/', false);
            return existingFile;
        }

        const { resolvedPrompt, error: promptError } = await this.resolvePromptForJournal(journalFolder.path, date);
        if (promptError) {
            new Notice(promptError);
        }

        const promptTemplateMode = resolvedPrompt?.deliveryMode === 'template-variables';
        const supportsPromptVariables = this.doesTemplateEngineSupportPromptContext(this.settings.templateEngine);
        const promptContext = promptTemplateMode && supportsPromptVariables
            ? getPromptTemplateContext(resolvedPrompt)
            : null;
        const promptBlock = resolvedPrompt && !promptTemplateMode
            ? createPromptBlock(resolvedPrompt, resolvedPrompt.deliveryMode)
            : '';
        const fallbackPromptBlock = resolvedPrompt
            ? createPromptBlock(resolvedPrompt, 'append-body')
            : '';

        let file: TFile | null = null;
        const templatePath = this.getJournalTemplatePath(this.settings.templateEngine, journalFolder.path);
        if (templatePath) {
            // Each engine owns its own application logic; the plugin only selects
            // the active engine and handles the fallback to default note content.
            const fileFromTemplate = await this.createJournalEntryFromTemplate(this.settings.templateEngine, journalFolder, templatePath, date, promptContext);

            if (fileFromTemplate) {
                file = fileFromTemplate;
            } else if (this.settings.templateFailureBehavior === 'abort') {
                new Notice('Journalyst did not create a note because the configured template could not be applied.');
                return null;
            }
        }

        if (!file) {
            const defaultPromptBlock = promptTemplateMode ? fallbackPromptBlock : promptBlock;
            if (resolvedPrompt && promptTemplateMode) {
                new Notice('The prompt could not be passed to a template, so Journalyst added it to the note body instead.');
            }
            const baseContents = this.getDefaultJournalEntryContents(date);
            const nextContents = defaultPromptBlock
                ? this.appendPromptBlock(baseContents, defaultPromptBlock)
                : baseContents;
            file = await this.app.vault.create(fullPath, nextContents);
        } else if (promptBlock) {
            await this.appendPromptBlockToFile(file, promptBlock);
        }

        await this.applyJournalystEntryProperties(file, {
            cadence: this.getJournalCadenceAtDate(journalFolder.path, date),
            date,
            entryType: 'entry',
            journalName: journalFolder.name,
            journalPath: journalFolder.path,
            promptSettings: this.getJournalPromptSettings(journalFolder.path),
            promptSource: resolvedPrompt?.sourceKey ?? null,
            promptTitle: resolvedPrompt?.prompt.title ?? null,
        });
        await this.captureJournalEntryBaseline(file);

        if (resolvedPrompt?.history) {
            this.settings.journalPromptHistory[journalFolder.path] = resolvedPrompt.history;
            await this.saveSettings();
        }

        await this.app.workspace.openLinkText(file.path, '/', false);
        return file;
    }

    private async createJournalEntryFromTemplate(
        templateEngine: TemplateEngine,
        journalFolder: TFolder,
        templatePath: string,
        date: string,
        promptContext?: TemplatePromptContext | null,
    ) {
        const templateStrategy = this.getTemplateStrategy(templateEngine);

        if (!templateStrategy) {
            return null;
        }

        return templateStrategy.createJournalEntry(journalFolder, templatePath, date, promptContext);
    }

    getJournalTemplatePath(templateEngine: TemplateEngine, journalPath: string) {
        if (templateEngine === 'templater') {
            return this.settings.templaterJournalTemplates[journalPath];
        }

        if (templateEngine === 'core') {
            return this.settings.coreJournalTemplates[journalPath];
        }

        return undefined;
    }

    async getJournalTemplateStatus(templateEngine: TemplateEngine, journalPath: string) {
        const templatePath = this.getJournalTemplatePath(templateEngine, journalPath);

        if (!templatePath) {
            return 'none';
        }

        const templateFile = this.app.vault.getAbstractFileByPath(templatePath);

        if (!(templateFile instanceof TFile)) {
            return 'missing';
        }

        const templateFolder = await this.getConfiguredTemplateFolder(templateEngine);
        if (!templateFolder) {
            return 'valid';
        }

        const normalizedFolder = normalizePath(templateFolder);
        const normalizedPath = normalizePath(templateFile.path);
        const folderPrefix = normalizedFolder === '/' ? '' : normalizedFolder + '/';

        return normalizedPath.startsWith(folderPrefix) ? 'valid' : 'outside-folder';
    }

    setJournalTemplatePath(templateEngine: TemplateEngine, journalPath: string, templatePath: string) {
        const templateMap = this.getJournalTemplateMap(templateEngine);

        if (templateMap && templatePath) {
            templateMap[journalPath] = templatePath;
        }
    }

    clearJournalTemplatePath(templateEngine: TemplateEngine, journalPath: string) {
        const templateMap = this.getJournalTemplateMap(templateEngine);

        if (templateMap) {
            delete templateMap[journalPath];
        }
    }

    getTemplaterAvailability(): TemplateAvailability | Promise<TemplateAvailability> {
        const templaterStrategy = this.getTemplateStrategy('templater');

        return templaterStrategy ? templaterStrategy.getAvailability() : 'disabled';
    }

    getTemplaterTemplateFolder() {
        const templaterStrategy = this.getTemplateStrategy('templater');

        return templaterStrategy ? templaterStrategy.getTemplateFolder() : null;
    }

    getTemplaterTemplateFiles() {
        const templaterStrategy = this.getTemplateStrategy('templater');

        return templaterStrategy ? templaterStrategy.getTemplateFiles() : [];
    }

    async getCoreTemplatesAvailability(): Promise<TemplateAvailability> {
        const coreStrategy = this.getTemplateStrategy('core');

        return coreStrategy ? coreStrategy.getAvailability() : 'disabled';
    }

    async getCoreTemplateFolder() {
        const coreStrategy = this.getTemplateStrategy('core');

        return coreStrategy ? coreStrategy.getTemplateFolder() : null;
    }

    async getCoreTemplateFiles() {
        const coreStrategy = this.getTemplateStrategy('core');

        return coreStrategy ? coreStrategy.getTemplateFiles() : [];
    }

    async getTemplateAvailability(templateEngine: TemplateEngine): Promise<TemplateAvailability> {
        const templateStrategy = this.getTemplateStrategy(templateEngine);
        return templateStrategy ? templateStrategy.getAvailability() : 'ready';
    }

    async getTemplateFiles(templateEngine: TemplateEngine) {
        const templateStrategy = this.getTemplateStrategy(templateEngine);
        return templateStrategy ? templateStrategy.getTemplateFiles() : [];
    }

    async getTemplateFolder(templateEngine: TemplateEngine) {
        const templateStrategy = this.getTemplateStrategy(templateEngine);
        return templateStrategy ? templateStrategy.getTemplateFolder() : null;
    }

    async getConfiguredTemplateFolder(templateEngine: TemplateEngine) {
        if (templateEngine === 'templater') {
            return this.getRawTemplaterTemplateFolder();
        }

        if (templateEngine === 'core') {
            return this.getRawCoreTemplateFolder();
        }

        return null;
    }

    formatJournalNoteBaseName(date: string) {
        return formatJournalNoteBaseName(date, this.settings);
    }

    formatJournalNoteFileName(date: string) {
        return formatJournalNoteFileName(date, this.settings);
    }

    parseJournalDateFromFile(file: TAbstractFile) {
        return parseJournalDateFromFile(file, this.settings);
    }

    findJournalEntryFile(journal: TFolder, date: string) {
        return findJournalEntryFile(journal, date, this.settings);
    }

    getJournalMigrationPlan() {
        return buildJournalMigrationPlan(this.journals, this.settings);
    }

    getJournalCadenceTimeline(journalPath: string) {
        return normalizeJournalCadenceTimeline(this.settings.journalCadenceRevisions[journalPath]);
    }

    getJournalSchedulePauses(journalPath: string) {
        return normalizeJournalSchedulePauses(this.settings.journalSchedulePauses[journalPath]);
    }

    getJournalCadenceSchedule(journalPath: string) {
        return createJournalCadenceSchedule(
            this.getJournalCadenceTimeline(journalPath),
            this.getJournalSchedulePauses(journalPath),
        );
    }

    getJournalCadenceAtDate(journalPath: string, date: string) {
        const timeline = this.getJournalCadenceTimeline(journalPath);
        if (timeline.length > 0) {
            return getCadenceForDate(timeline, date) ?? timeline[0]!.cadence;
        }

        return normalizeJournalCadence(this.settings.journalCadences?.[journalPath]);
    }

    getJournalCadence(journalPath: string) {
        const timeline = this.getJournalCadenceTimeline(journalPath);
        return timeline.length > 0
            ? getCurrentJournalCadence(timeline, moment().format('YYYY-MM-DD'))
            : normalizeJournalCadence(this.settings.journalCadences?.[journalPath]);
    }

    async updateJournalCadence(journalPath: string, cadence: JournalCadenceConfig) {
        const result = await this.saveJournalCadence(journalPath, cadence);
        if (!result.ok) {
            throw new Error(result.error);
        }
    }

    async saveJournalCadence(
        journalPath: string,
        cadence: JournalCadenceConfig,
    ): Promise<JournalAutosaveResult<JournalCadenceConfig>> {
        if (!this.getJournalByPath(journalPath)) {
            return { ok: false, error: 'Journalyst could not find that journal.' };
        }

        if (cadence.type === 'weekly-days'
            && !(cadence.weekdays ?? []).some(day => Number.isInteger(day) && day >= 0 && day <= 6)) {
            return { ok: false, error: 'Choose at least one expected weekday.' };
        }
        if (cadence.type === 'interval' && (!cadence.intervalDays || cadence.intervalDays < 1)) {
            return { ok: false, error: 'The interval must be at least one day.' };
        }
        if (cadence.type === 'interval' && !moment(cadence.startDate, 'YYYY-MM-DD', true).isValid()) {
            return { ok: false, error: 'Choose a valid interval anchor date.' };
        }
        const normalized = normalizeJournalCadence(cadence);
        this.journalSettingsUndo = null;

        const today = moment().format('YYYY-MM-DD');
        const timeline = this.getJournalCadenceTimeline(journalPath);
        const current = getCadenceForDate(timeline, today);
        if (current && JSON.stringify(current) === JSON.stringify(normalized)) {
            return { ok: true, value: normalized, undoToken: null };
        }

        const before = this.captureScheduleUndoSnapshot(journalPath);
        const nextTimeline = timeline.filter(revision => revision.effectiveFrom !== today);
        nextTimeline.push({ effectiveFrom: today, cadence: normalized });
        this.settings.journalCadenceRevisions[journalPath] = normalizeJournalCadenceTimeline(nextTimeline);
        this.clearReminderHistoryForJournal(journalPath);

        try {
            await this.saveSettings();
        } catch (error) {
            this.applyScheduleUndoSnapshot(journalPath, before);
            return {
                ok: false,
                error: error instanceof Error ? error.message : 'Journalyst could not save the journal schedule.',
            };
        }

        if (this.isBasesIntegrationEnabled()) {
            const journal = this.getJournalByPath(journalPath);
            if (journal) {
                try {
                    await this.applyJournalNotePropertyBackfill(await this.getJournalBackfillItems(journal));
                } catch (error) {
                    console.error('Journalyst could not refresh cadence properties after saving the schedule.', error);
                    new Notice('The schedule was saved, but some managed Bases properties could not be refreshed.');
                }
            }
        }
        try {
            await this.checkReminderNotifications(true);
        } catch (error) {
            console.error('Journalyst could not refresh reminders after saving the schedule.', error);
        }
        this.refreshCompletionViews();
        const undoToken = this.registerJournalSettingsUndo({
            journalPath,
            section: 'schedule',
            before,
            after: this.captureScheduleUndoSnapshot(journalPath),
        });
        return { ok: true, value: this.getJournalCadence(journalPath), undoToken };
    }

    async saveJournalSchedulePause(
        journalPath: string,
        update: JournalSchedulePauseUpdate,
    ): Promise<JournalSchedulePauseActionResult> {
        if (!this.getJournalByPath(journalPath)) {
            return { ok: false, error: 'Journalyst could not find that journal.' };
        }

        const name = update.name.trim();
        if (!name) {
            return { ok: false, error: 'Enter a name for this pause.' };
        }
        if (!moment(update.startDate, 'YYYY-MM-DD', true).isValid()
            || !moment(update.endDate, 'YYYY-MM-DD', true).isValid()) {
            return { ok: false, error: 'Choose valid start and end dates.' };
        }
        if (update.startDate > update.endDate) {
            return { ok: false, error: 'The pause must end on or after its start date.' };
        }

        const currentPauses = this.getJournalSchedulePauses(journalPath);
        if (update.id && !currentPauses.some(pause => pause.id === update.id)) {
            return { ok: false, error: 'Journalyst could not find that pause.' };
        }

        const overlaps = currentPauses.some(pause => pause.id !== update.id
            && pause.startDate <= update.endDate
            && pause.endDate >= update.startDate);
        if (overlaps) {
            return { ok: false, error: 'This pause overlaps another pause for the journal.' };
        }

        const pause: JournalSchedulePause = {
            id: update.id ?? crypto.randomUUID(),
            name,
            startDate: update.startDate,
            endDate: update.endDate,
        };
        const nextPauses = normalizeJournalSchedulePauses([
            ...currentPauses.filter(current => current.id !== pause.id),
            pause,
        ]);
        return this.persistJournalSchedulePauses(journalPath, nextPauses);
    }

    async removeJournalSchedulePause(
        journalPath: string,
        pauseId: string,
    ): Promise<JournalSchedulePauseActionResult> {
        if (!this.getJournalByPath(journalPath)) {
            return { ok: false, error: 'Journalyst could not find that journal.' };
        }

        const currentPauses = this.getJournalSchedulePauses(journalPath);
        if (!currentPauses.some(pause => pause.id === pauseId)) {
            return { ok: false, error: 'Journalyst could not find that pause.' };
        }

        return this.persistJournalSchedulePauses(
            journalPath,
            currentPauses.filter(pause => pause.id !== pauseId),
        );
    }

    private async persistJournalSchedulePauses(
        journalPath: string,
        pauses: JournalSchedulePause[],
    ): Promise<JournalSchedulePauseActionResult> {
        this.journalSettingsUndo = null;
        const previousPauses = this.settings.journalSchedulePauses[journalPath];
        const previousReminderHistory = { ...this.settings.reminderHistory };
        this.settings.journalSchedulePauses[journalPath] = pauses;
        this.clearReminderHistoryForJournal(journalPath);

        try {
            await this.saveSettings();
        } catch (error) {
            if (previousPauses) {
                this.settings.journalSchedulePauses[journalPath] = previousPauses;
            } else {
                delete this.settings.journalSchedulePauses[journalPath];
            }
            this.settings.reminderHistory = previousReminderHistory;
            return {
                ok: false,
                error: error instanceof Error ? error.message : 'Journalyst could not save the schedule pause.',
            };
        }

        try {
            await this.checkReminderNotifications(true);
        } catch (error) {
            console.error('Journalyst could not refresh reminders after saving a schedule pause.', error);
        }
        this.refreshCompletionViews();
        return { ok: true, pauses };
    }

    getBuiltInPromptLists() {
        return BUILT_IN_PROMPT_LISTS;
    }

    getCustomPromptLists() {
        return this.settings.customPromptLists;
    }

    getJournalPromptSettings(journalPath: string) {
        return normalizeJournalPromptSettings(this.settings.journalPromptSettings[journalPath]);
    }

    async updateJournalPromptSettings(journalPath: string, promptSettings: JournalPromptSettings) {
        const normalizedSettings = normalizeJournalPromptSettings(promptSettings);
        const previousSettings = this.getJournalPromptSettings(journalPath);

        this.settings.journalPromptSettings[journalPath] = normalizedSettings;

        if (this.getPromptHistoryIdentity(previousSettings) !== this.getPromptHistoryIdentity(normalizedSettings)) {
            delete this.settings.journalPromptHistory[journalPath];
        }

        await this.saveSettings();
    }

    async upsertCustomPromptList(listId: string, name: string, rawPromptText: string) {
        this.settings.customPromptLists[listId] = createCustomPromptListDefinition(listId, name, rawPromptText);
        await this.saveSettings();
    }

    async deleteCustomPromptList(listId: string) {
        delete this.settings.customPromptLists[listId];

        Object.entries(this.settings.journalPromptSettings).forEach(([journalPath, promptSettings]) => {
            const normalized = normalizeJournalPromptSettings(promptSettings);
            const weekdaySourceOverrides = Object.fromEntries(
                Object.entries(normalized.weekdaySourceOverrides)
                    .filter(([, source]) => !(
                        source.sourceType === 'custom' && source.selectedListId === listId
                    )),
            );
            const usesDeletedDefault = normalized.sourceType === 'custom'
                && normalized.selectedListId === listId;
            const sourceOverridesChanged = Object.keys(weekdaySourceOverrides).length
                !== Object.keys(normalized.weekdaySourceOverrides).length;

            if (usesDeletedDefault || sourceOverridesChanged) {
                this.settings.journalPromptSettings[journalPath] = normalizeJournalPromptSettings({
                    ...normalized,
                    enabled: usesDeletedDefault ? false : normalized.enabled,
                    selectedListId: usesDeletedDefault ? undefined : normalized.selectedListId,
                    staticPromptId: usesDeletedDefault ? undefined : normalized.staticPromptId,
                    weekdaySourceOverrides,
                });
                delete this.settings.journalPromptHistory[journalPath];
            }
        });

        await this.saveSettings();
    }

    createCustomPromptListId() {
        return `custom-${Date.now().toString(36)}`;
    }

    async getResolvedPromptList(journalPath: string) {
        const promptSettings = this.getJournalPromptSettings(journalPath);
        return resolvePromptList(promptSettings, this.getPromptResolveContext());
    }

    async getPromptOptionsForSettings(promptSettings: JournalPromptSettings) {
        return (await resolvePromptList(
            normalizeJournalPromptSettings(promptSettings),
            this.getPromptResolveContext(),
        ))?.prompts ?? [];
    }

    async getPromptPreviewForSettings(promptSettings: JournalPromptSettings): Promise<JournalPromptPreviewModel | null> {
        const resolvedPrompt = await resolvePromptPreview(
            normalizeJournalPromptSettings(promptSettings),
            this.getPromptResolveContext(),
        );
        if (!resolvedPrompt) {
            return null;
        }

        return {
            deliveryMode: resolvedPrompt.deliveryMode,
            output: createPromptOutputPreview(resolvedPrompt),
            promptText: resolvedPrompt.prompt.text,
            promptTitle: resolvedPrompt.prompt.title,
            sourceLabel: resolvedPrompt.list.name,
        };
    }

    async getPromptPreview(journalPath: string, limit = 3) {
        const resolvedList = await this.getResolvedPromptList(journalPath);
        return resolvedList?.prompts.slice(0, limit) ?? [];
    }

    async getJournalSettingsViewModel(journalPath: string): Promise<JournalSettingsViewModel | null> {
        const journal = this.getJournalByPath(journalPath);
        if (!journal) {
            return null;
        }

        const templateEngine = this.settings.templateEngine;
        const builtInPromptLists = Object.values(this.getBuiltInPromptLists());
        const customPromptLists = Object.values(this.getCustomPromptLists());
        const promptFiles = this.app.vault.getMarkdownFiles();
        const promptSettings = this.getJournalPromptSettings(journal.path);
        const basesBackfillItemsPromise = this.isBasesIntegrationEnabled()
            ? this.getJournalBackfillItems(journal)
            : Promise.resolve([]);
        const [templateAvailability, templateFiles, resolvedPromptList, templateStatus, basesBackfillItems] = await Promise.all([
            templateEngine === 'none'
                ? Promise.resolve('not-applicable' as const)
                : this.getTemplateAvailability(templateEngine),
            templateEngine === 'none'
                ? Promise.resolve([])
                : this.getTemplateFiles(templateEngine),
            this.getResolvedPromptList(journalPath),
            this.getJournalTemplateStatus(templateEngine, journal.path),
            basesBackfillItemsPromise,
        ]);
        const legacyWeekdayPromptLabels = Object.fromEntries(
            await Promise.all(Object.entries(promptSettings.weekdayOverrides)
                .map(async ([day, promptId]) => {
                    const currentPrompt = resolvedPromptList?.prompts.find(prompt => prompt.id === promptId);
                    const legacyPrompt = currentPrompt
                        ? null
                        : await resolvePromptOptionById(promptId, this.getPromptResolveContext());
                    return [day, currentPrompt?.title ?? legacyPrompt?.prompt.title ?? 'Legacy fixed prompt'] as const;
                })),
        );

        return {
            journalPath: journal.path,
            journalName: journal.name,
            entryCount: journal.children.filter(child => (
                child instanceof TFile && !!this.parseJournalDateFromFile(child)
            )).length,
            cadence: this.getJournalCadence(journal.path),
            cadenceHistory: this.getJournalCadenceTimeline(journal.path),
            schedulePauses: this.getJournalSchedulePauses(journal.path),
            reminderSettings: this.getJournalReminderSettings(journal.path),
            reminderSummary: this.getJournalReminderSummary(journal.path),
            remindersEnabled: this.areRemindersEnabled(),
            promptSettings,
            promptSourceOptions: [
                ...builtInPromptLists.map(list => ({
                    group: 'Built-in libraries' as const,
                    label: list.name,
                    promptCount: list.prompts.length,
                    source: { sourceType: 'built-in' as const, selectedListId: list.id },
                })),
                ...customPromptLists.map(list => ({
                    group: 'Custom libraries' as const,
                    label: list.name,
                    promptCount: list.prompts.length,
                    source: { sourceType: 'custom' as const, selectedListId: list.id },
                })),
                ...promptFiles.map(file => ({
                    group: 'Markdown notes' as const,
                    label: file.path,
                    source: { sourceType: 'file' as const, selectedFilePath: file.path },
                })),
            ],
            promptOptions: resolvedPromptList?.prompts ?? [],
            legacyWeekdayPromptLabels,
            templateEngine,
            templateAvailability,
            templateFailureBehavior: this.settings.templateFailureBehavior,
            templatePath: this.getJournalTemplatePath(templateEngine, journal.path) ?? null,
            templateStatus,
            templateOptions: templateFiles.map(file => ({ label: file.path, value: file.path })),
            bases: this.buildJournalBasesIntegrationModel(journal, basesBackfillItems.length),
        };
    }

    async saveJournalEntrySetup(
        journalPath: string,
        update: JournalEntrySetupUpdate,
    ): Promise<JournalAutosaveResult<JournalEntrySetupUpdate>> {
        if (!this.getJournalByPath(journalPath)) {
            return { ok: false, error: 'Journalyst could not find that journal.' };
        }

        const templateEngine = this.settings.templateEngine;
        const templateMap = this.getJournalTemplateMap(templateEngine);
        const normalizedPromptSettings = normalizeJournalPromptSettings(update.promptSettings);
        const currentPromptSettings = this.getJournalPromptSettings(journalPath);
        const normalizedUpdate: JournalEntrySetupUpdate = {
            templatePath: templateMap ? update.templatePath : null,
            promptSettings: normalizedPromptSettings,
        };
        const currentUpdate: JournalEntrySetupUpdate = {
            templatePath: this.getJournalTemplatePath(templateEngine, journalPath) ?? null,
            promptSettings: currentPromptSettings,
        };
        this.journalSettingsUndo = null;
        if (JSON.stringify(currentUpdate) === JSON.stringify(normalizedUpdate)) {
            return { ok: true, value: normalizedUpdate, undoToken: null };
        }

        const before = this.captureEntrySetupUndoSnapshot(journalPath);

        if (templateMap) {
            if (normalizedUpdate.templatePath) {
                templateMap[journalPath] = normalizedUpdate.templatePath;
            } else {
                delete templateMap[journalPath];
            }
        }
        this.settings.journalPromptSettings[journalPath] = normalizedPromptSettings;
        if (this.getPromptHistoryIdentity(currentPromptSettings) !== this.getPromptHistoryIdentity(normalizedPromptSettings)) {
            delete this.settings.journalPromptHistory[journalPath];
        }

        try {
            await this.saveSettings();
            this.refreshCompletionViews();
        } catch (error) {
            this.applyEntrySetupUndoSnapshot(journalPath, before);
            return {
                ok: false,
                error: error instanceof Error ? error.message : 'Journalyst could not save the entry setup.',
            };
        }

        const undoToken = this.registerJournalSettingsUndo({
            journalPath,
            section: 'entry-setup',
            before,
            after: this.captureEntrySetupUndoSnapshot(journalPath),
        });
        return { ok: true, value: this.getJournalEntrySetupValue(journalPath), undoToken };
    }

    async renameJournal(journalPath: string, nextName: string): Promise<JournalSettingsActionResult> {
        const journal = this.getJournalByPath(journalPath);
        if (!journal || !journal.parent) {
            return { ok: false, error: 'Journalyst could not find that journal.' };
        }

        const validation = this.validateJournalNames([nextName]);
        if (!validation.ok) {
            return validation;
        }
        const normalizedName = validation.names[0];
        if (!normalizedName) {
            return { ok: false, error: 'Enter a journal name.' };
        }
        if (normalizedName === journal.name) {
            return { ok: true, journalPath: journal.path };
        }

        const conflict = this.findChildByName(journal.parent, normalizedName);
        if (conflict && conflict !== journal) {
            return { ok: false, error: `A journal or file named "${conflict.name}" already exists.` };
        }

        const oldPath = journal.path;
        const targetPath = this.getChildPath(journal.parent, normalizedName);
        this.journalSettingsUndo = null;
        try {
            await this.app.fileManager.renameFile(journal, targetPath);
            if (this.settings.journalCadenceRevisions[oldPath]) {
                this.remapJournalPaths(oldPath, targetPath);
                await this.saveSettings();
            }
            if (this.reviewState.journalPath === oldPath) {
                this.reviewState.journalPath = targetPath;
            }
            this.refreshJournals();

            if (this.isBasesIntegrationEnabled()) {
                const renamedJournal = this.getJournalByPath(targetPath);
                if (renamedJournal) {
                    try {
                        await this.applyJournalNotePropertyBackfill(await this.getJournalBackfillItems(renamedJournal));
                    } catch (error) {
                        console.error('Journalyst could not refresh Bases properties after renaming the journal.', error);
                        new Notice('The journal was renamed, but some managed Bases properties could not be refreshed.');
                    }
                }
            }

            this.refreshCompletionViews();
            return { ok: true, journalPath: targetPath };
        } catch (error) {
            return {
                ok: false,
                error: error instanceof Error ? error.message : 'Journalyst could not rename the journal.',
            };
        }
    }

    getJournalMigrationPlanForFormat(noteDateFormat: string) {
        return buildJournalMigrationPlan(this.journals, {
            ...this.settings,
            noteDateFormat,
        });
    }

    formatJournalNoteFileNameForFormat(date: string, noteDateFormat: string) {
        return formatJournalNoteFileName(date, {
            ...this.settings,
            noteDateFormat,
        });
    }

    async applyJournalMigrationPlan(migrationItems: JournalNoteMigrationItem[]) {
        const safeItems = migrationItems.filter(item => !item.hasConflict);
        let renamedCount = 0;

        for (const item of safeItems) {
            const file = this.app.vault.getAbstractFileByPath(item.currentPath);

            if (!(file instanceof TFile)) {
                continue;
            }

            await this.app.fileManager.renameFile(file, item.targetPath);
            renamedCount += 1;
        }

        if (renamedCount > 0) {
            new Notice(`Journalyst renamed ${renamedCount} journal note${renamedCount === 1 ? '' : 's'}.`);
        }

        this.refreshJournals();
    }

    async updateNoteDateFormat(noteDateFormat: string) {
        const nextFormat = noteDateFormat.trim();

        if (!nextFormat || nextFormat === this.settings.noteDateFormat) {
            return;
        }

        this.settings.noteDateFormatHistory = Array.from(new Set([
            this.settings.noteDateFormat,
            ...this.settings.noteDateFormatHistory,
        ].filter(Boolean)));
        this.settings.noteDateFormat = nextFormat;
        await this.saveSettings();
    }

    getReviewState() {
        return this.reviewState;
    }

    isBasesIntegrationEnabled() {
        return this.settings.basesIntegrationEnabled;
    }

    async updateBasesIntegrationEnabled(enabled: boolean) {
        this.settings.basesIntegrationEnabled = enabled;
        await this.saveSettings();
        this.refreshReviewViews();
    }

    areRemindersEnabled() {
        return this.settings.remindersEnabled;
    }

    async updateRemindersEnabled(enabled: boolean) {
        this.settings.remindersEnabled = enabled;
        await this.saveSettings();
        if (enabled) {
            await this.checkReminderNotifications(true);
        }
    }

    areOsNotificationsEnabled() {
        return this.settings.osNotificationsEnabled;
    }

    async updateOsNotificationsEnabled(enabled: boolean) {
        this.settings.osNotificationsEnabled = enabled;
        await this.saveSettings();
    }

    getReminderQuietHours() {
        return this.settings.reminderQuietHours;
    }

    async updateReminderQuietHours(settings: ReminderQuietHoursSettings) {
        this.settings.reminderQuietHours = normalizeReminderQuietHours(settings);
        await this.saveSettings();
        await this.checkReminderNotifications(true);
        this.refreshReviewViews();
    }

    getSidebarMode() {
        return this.settings.sidebarMode;
    }

    async updateSidebarMode(sidebarMode: SidebarMode) {
        this.settings.sidebarMode = sidebarMode;
        await this.saveSettings();
        this.refreshSidebarView();
    }

    getNotificationPermissionStatus() {
        if (typeof Notification === 'undefined') {
            return 'unsupported';
        }

        return Notification.permission;
    }

    async requestNotificationPermission() {
        if (typeof Notification === 'undefined') {
            return 'unsupported';
        }

        return Notification.requestPermission();
    }

    async sendTestReminderNotification() {
        await this.deliverReminderEvent({
            historyKey: buildReminderHistoryKey('journalyst', 'test', moment().format()),
            journalPath: '',
            journalName: 'Journalyst',
            deliveryMode: this.settings.osNotificationsEnabled ? 'os-preferred' : 'in-app',
            title: 'Journalyst test reminder',
            message: 'Notifications are working and ready for your journals.',
            target: {
                type: 'review',
                anchorDate: moment().format('YYYY-MM-DD'),
                reviewPeriod: 'weekly',
            },
        }, false);
    }

    getJournalReminderSettings(journalPath: string) {
        return normalizeJournalReminderSettings(this.settings.journalReminderSettings[journalPath]);
    }

    async updateJournalReminderSettings(journalPath: string, reminderSettings: JournalReminderSettings) {
        const result = await this.saveJournalReminderSettings(journalPath, reminderSettings);
        if (!result.ok) {
            throw new Error(result.error);
        }
    }

    async saveJournalReminderSettings(
        journalPath: string,
        reminderSettings: JournalReminderSettings,
    ): Promise<JournalAutosaveResult<JournalReminderSettings>> {
        if (!this.getJournalByPath(journalPath)) {
            return { ok: false, error: 'Journalyst could not find that journal.' };
        }

        const normalized = normalizeJournalReminderSettings(reminderSettings);
        this.journalSettingsUndo = null;
        if (JSON.stringify(this.getJournalReminderSettings(journalPath)) === JSON.stringify(normalized)) {
            return { ok: true, value: normalized, undoToken: null };
        }

        const before = this.captureReminderUndoSnapshot(journalPath);
        this.settings.journalReminderSettings[journalPath] = normalized;
        this.clearReminderHistoryForJournal(journalPath);

        try {
            await this.saveSettings();
        } catch (error) {
            this.applyReminderUndoSnapshot(journalPath, before);
            return {
                ok: false,
                error: error instanceof Error ? error.message : 'Journalyst could not save the reminder rules.',
            };
        }

        try {
            await this.checkReminderNotifications(true);
        } catch (error) {
            console.error('Journalyst could not refresh reminders after saving journal rules.', error);
        }
        this.refreshCompletionViews();
        const undoToken = this.registerJournalSettingsUndo({
            journalPath,
            section: 'reminders',
            before,
            after: this.captureReminderUndoSnapshot(journalPath),
        });
        return { ok: true, value: this.getJournalReminderSettings(journalPath), undoToken };
    }

    async undoJournalSettingsChange(undoToken: string): Promise<JournalAutosaveUndoResult> {
        const record = this.journalSettingsUndo;
        if (!record || record.token !== undoToken) {
            return { ok: false, error: 'That settings change can no longer be undone.', canRetry: false };
        }
        if (!this.getJournalByPath(record.journalPath)) {
            this.journalSettingsUndo = null;
            return { ok: false, error: 'Journalyst could not find that journal.', canRetry: false };
        }

        if (!this.isJournalSettingsUndoCurrent(record)) {
            this.journalSettingsUndo = null;
            return {
                ok: false,
                error: 'These settings changed again, so the previous save can no longer be undone.',
                canRetry: false,
            };
        }

        this.applyJournalSettingsUndoSnapshot(record, 'before');
        try {
            await this.saveSettings();
        } catch (error) {
            this.applyJournalSettingsUndoSnapshot(record, 'after');
            return {
                ok: false,
                error: error instanceof Error ? error.message : 'Journalyst could not undo that settings change.',
                canRetry: true,
            };
        }

        this.journalSettingsUndo = null;
        await this.refreshJournalAutosaveEffects(record.section, record.journalPath);
        return {
            ok: true,
            section: record.section,
            value: this.getJournalAutosaveValue(record.section, record.journalPath),
        };
    }

    getJournalReminderSummary(journalPath: string) {
        if (!this.settings.remindersEnabled) {
            return 'Reminders off';
        }

        const cadence = this.getJournalCadence(journalPath);
        const reminderSettings = this.getJournalReminderSettings(journalPath);

        return hasAnyEnabledReminder(reminderSettings, cadence) ? 'Reminders active' : 'Reminders off';
    }

    async setReviewState(
        journalPath: string | null,
        anchorDate: string,
        activeTab?: ReviewWorkspaceTab,
        journalSettingsSection?: JournalSettingsSection,
    ) {
        this.reviewState = {
            journalPath,
            anchorDate,
            activeTab: activeTab ?? this.reviewState.activeTab,
            journalSettingsSection: journalSettingsSection ?? this.reviewState.journalSettingsSection,
        };
    }

    getDefaultReviewJournalPath() {
        return this.journals[0]?.path ?? null;
    }

    getJournalByPath(journalPath: string) {
        return this.journals.find(journal => journal.path === journalPath) ?? null;
    }

    inferCurrentJournal() {
        const activeFile = this.app.workspace.getActiveFile();

        if (!activeFile) {
            return null;
        }

        return this.journals.find(journal => activeFile.path.startsWith(journal.path + '/')) ?? null;
    }

    async checkReminderNotifications(force = false) {
        if (!this.settings.remindersEnabled) {
            return;
        }

        const now = moment();
        if (isWithinReminderQuietHours(now, this.settings.reminderQuietHours)) {
            return;
        }

        const currentMinute = now.format('YYYY-MM-DD HH:mm');
        if (!force && this.lastReminderCheckMinute === currentMinute) {
            return;
        }

        this.lastReminderCheckMinute = currentMinute;

        for (const journal of this.journals) {
            const events = this.getReminderEventsForJournal(journal, now);

            for (const event of events) {
                await this.deliverReminderEvent(event);
            }
        }

        this.refreshReviewViews();
    }

    async generateBasesForJournal(journal: TFolder | string): Promise<JournalSettingsActionResult> {
        if (!this.settings.basesIntegrationEnabled) {
            new Notice('Enable Bases integration in Journalyst settings first.');
            return { ok: false, error: 'Enable Bases integration in Journalyst settings first.' };
        }

        if (!this.isBasesCorePluginAvailable()) {
            new Notice('Enable the Obsidian Bases core plugin first.');
            return { ok: false, error: 'Enable the Obsidian Bases core plugin first.' };
        }

        const resolvedJournal = typeof journal === 'string' ? this.getJournalByPath(journal) : journal;

        if (!resolvedJournal) {
            new Notice('Journalyst could not find that journal for Bases generation.');
            return { ok: false, error: 'Journalyst could not find that journal.' };
        }

        try {
            const results = await Promise.all((['entries', 'reflections'] as BasesGenerationTarget[])
                .map(target => this.ensureManagedBaseFile(resolvedJournal, target)));
            const createdCount = results.filter(Boolean).length;
            this.showBasesGenerationNotice(createdCount, results.length - createdCount, resolvedJournal.name);
            return { ok: true };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Journalyst could not create the journal Bases.';
            new Notice(message);
            return { ok: false, error: message };
        }
    }

    async generateBasesForAllJournals(): Promise<JournalSettingsActionResult> {
        if (!this.settings.basesIntegrationEnabled) {
            new Notice('Enable Bases integration in Journalyst settings first.');
            return { ok: false, error: 'Enable Bases integration in Journalyst settings first.' };
        }

        if (!this.isBasesCorePluginAvailable()) {
            new Notice('Enable the Obsidian Bases core plugin first.');
            return { ok: false, error: 'Enable the Obsidian Bases core plugin first.' };
        }

        if (this.journals.length === 0) {
            new Notice('Journalyst could not find any journals for Bases generation.');
            return { ok: false, error: 'Journalyst could not find any journals.' };
        }

        let createdCount = 0;
        let preservedCount = 0;
        const errors: string[] = [];

        for (const journal of this.journals) {
            for (const target of ['entries', 'reflections'] as BasesGenerationTarget[]) {
                try {
                    const created = await this.ensureManagedBaseFile(journal, target);
                    if (created) createdCount += 1;
                    else preservedCount += 1;
                } catch (error) {
                    errors.push(error instanceof Error ? error.message : `Journalyst could not create a Base for ${journal.name}.`);
                }
            }
        }

        this.showBasesGenerationNotice(createdCount, preservedCount);
        if (errors.length > 0) {
            const message = `${errors.length} Base file${errors.length === 1 ? '' : 's'} could not be created.`;
            new Notice(message);
            return { ok: false, error: `${message} ${errors[0]}` };
        }

        return { ok: true };
    }

    async resetJournalBase(journalPath: string, target: BasesGenerationTarget): Promise<JournalSettingsActionResult> {
        if (!this.settings.basesIntegrationEnabled) {
            return { ok: false, error: 'Enable Bases integration in Journalyst settings first.' };
        }

        if (!this.isBasesCorePluginAvailable()) {
            return { ok: false, error: 'Enable the Obsidian Bases core plugin first.' };
        }

        const journal = this.getJournalByPath(journalPath);
        if (!journal) {
            return { ok: false, error: 'Journalyst could not find that journal.' };
        }

        try {
            await this.writeManagedBaseFile(journal, target);
            return { ok: true };
        } catch (error) {
            return {
                ok: false,
                error: error instanceof Error ? error.message : 'Journalyst could not reset that Base.',
            };
        }
    }

    async ensureJournalBase(journalPath: string, target: BasesGenerationTarget): Promise<JournalSettingsActionResult> {
        if (!this.settings.basesIntegrationEnabled) {
            return { ok: false, error: 'Enable Bases integration in Journalyst settings first.' };
        }

        if (!this.isBasesCorePluginAvailable()) {
            return { ok: false, error: 'Enable the Obsidian Bases core plugin first.' };
        }

        const journal = this.getJournalByPath(journalPath);
        if (!journal) {
            return { ok: false, error: 'Journalyst could not find that journal.' };
        }

        try {
            await this.ensureManagedBaseFile(journal, target);
            return { ok: true };
        } catch (error) {
            return {
                ok: false,
                error: error instanceof Error ? error.message : 'Journalyst could not create that Base.',
            };
        }
    }

    async getJournalNotePropertyBackfillPreview(journalPath?: string | null) {
        const journals = journalPath ? this.journals.filter(journal => journal.path === journalPath) : this.journals;
        const items: JournalNotePropertyBackfillItem[] = [];

        for (const journal of journals) {
            const journalItems = await this.getJournalBackfillItems(journal);
            items.push(...journalItems);
        }

        return items;
    }

    async applyJournalNotePropertyBackfill(items: JournalNotePropertyBackfillItem[]) {
        let updatedCount = 0;

        for (const item of items) {
            const file = this.app.vault.getAbstractFileByPath(item.filePath);

            if (!(file instanceof TFile)) {
                continue;
            }

            await this.applyJournalystPropertiesToFile(file, item.properties);
            updatedCount += 1;
        }

        if (updatedCount > 0) {
            new Notice(`Journalyst backfilled properties for ${updatedCount} note${updatedCount === 1 ? '' : 's'}.`);
        }
    }

    async createSynthesisNote(journalPath: string, anchorDate: string, periodType: SynthesisPeriodType) {
        const journal = this.getJournalByPath(journalPath);
        if (!journal) {
            new Notice('Journalyst could not find that journal for synthesis.');
            return null;
        }

        const preview = buildSynthesisNotePreview(journal, anchorDate, this.settings, periodType, {
            isEntryComplete: file => this.isJournalEntryComplete(file),
        });
        const filePath = normalizePath(journal.path + '/' + preview.payload.fileName);
        const existingFile = this.app.vault.getAbstractFileByPath(filePath);

        if (existingFile instanceof TFile) {
            await this.app.workspace.openLinkText(existingFile.path, '/', false);
            return existingFile;
        }

        const file = await this.app.vault.create(filePath, preview.payload.body);
        await this.applyJournalystEntryProperties(file, {
            cadence: this.getJournalCadenceAtDate(journal.path, anchorDate),
            entryType: this.getSynthesisEntryType(periodType),
            journalName: journal.name,
            journalPath: journal.path,
            periodEnd: preview.payload.endDate,
            periodStart: preview.payload.startDate,
            periodType,
        });
        await this.app.workspace.openLinkText(file.path, '/', false);
        return file;
    }

    getSynthesisNoteKind(file: TFile): ParsedJournalystNoteKind | null {
        const parsedFileName = parseJournalystNoteKind(file);
        if (parsedFileName?.periodType) {
            return parsedFileName;
        }

        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        const periodType = frontmatter?.journalyst_period_type;
        const periodStart = String(frontmatter?.journalyst_period_start ?? '');
        const periodEnd = String(frontmatter?.journalyst_period_end ?? '');
        const entryType = frontmatter?.journalyst_entry_type;
        const expectedEntryType = periodType === 'weekly'
            ? 'weekly-review'
            : periodType === 'monthly'
                ? 'monthly-reflection'
                : periodType === 'quarterly'
                    ? 'quarter-summary'
                    : null;

        if (
            !expectedEntryType
            || entryType !== expectedEntryType
            || !moment(periodStart, 'YYYY-MM-DD', true).isValid()
            || !moment(periodEnd, 'YYYY-MM-DD', true).isValid()
            || periodStart > periodEnd
        ) {
            return null;
        }

        return {
            entryType: expectedEntryType,
            periodType,
            periodStart,
            periodEnd,
        };
    }

    private getReminderEventsForJournal(journal: TFolder, now: moment.Moment) {
        const entries = journal.children
            .filter((file): file is TFile => file instanceof TFile)
            .map(file => ({
                date: this.parseJournalDateFromFile(file),
                isComplete: this.isJournalEntryComplete(file),
            }))
            .filter((entry): entry is { date: string; isComplete: boolean } => !!entry.date);

        return getReminderEventsForJournal({
            cadence: this.getJournalCadenceSchedule(journal.path),
            dateSet: new Set(entries.filter(entry => entry.isComplete).map(entry => entry.date)),
            existingDateSet: new Set(entries.map(entry => entry.date)),
            journalName: journal.name,
            journalPath: journal.path,
            reminderSettings: this.getJournalReminderSettings(journal.path),
            synthesisNoteExists: (period, anchorDate) => this.doesSynthesisNoteExist(journal, period, anchorDate),
        }, now, this.settings.reminderHistory);
    }

    private doesSynthesisNoteExist(journal: TFolder, period: ReviewReminderPeriod, anchorDate: string) {
        const fileName = buildSynthesisReminderFileName(period, anchorDate);
        return this.app.vault.getAbstractFileByPath(normalizePath(`${journal.path}/${fileName}`)) instanceof TFile;
    }

    private async deliverReminderEvent(event: ResolvedReminderEvent, persist = true) {
        new Notice(`${event.title}: ${event.message}`);

        if (event.deliveryMode === 'os-preferred' && this.settings.osNotificationsEnabled) {
            this.sendOsNotification(event);
        }

        if (persist) {
            this.settings.reminderHistory[event.historyKey] = {
                journalPath: event.journalPath,
                ruleKey: event.historyKey.split('::')[1] ?? '',
                occurrenceKey: event.historyKey.split('::')[2] ?? '',
                sentAt: moment().toISOString(),
            };
            await this.saveSettings();
        }
    }

    private sendOsNotification(event: ResolvedReminderEvent) {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
            return;
        }

        const notification = new Notification(event.title, {
            body: event.message,
        });

        notification.onclick = () => {
            void this.openReminderTarget(event);
        };
    }

    private async openReminderTarget(event: ResolvedReminderEvent) {
        if (event.target.type === 'entry') {
            const journal = this.getJournalByPath(event.journalPath);
            if (journal) {
                await this.createJournalEntry(journal, event.target.anchorDate);
            }
            return;
        }

        await this.activateReviewView(event.journalPath, event.target.anchorDate, 'synthesis');
    }

    private getTemplaterPlugin(): TemplaterPlugin | undefined {
        const plugins = this.getObsidianPlugins();

        return plugins?.plugins?.['templater-obsidian'] as TemplaterPlugin | undefined;
    }

    private getObsidianPlugins(): ObsidianPlugins | undefined {
        const appWithPlugins = this.app as typeof this.app & {
            plugins?: ObsidianPlugins;
        };

        return appWithPlugins.plugins;
    }

    private getObsidianInternalPlugins(): ObsidianInternalPlugins | undefined {
        const appWithInternalPlugins = this.app as typeof this.app & {
            internalPlugins?: ObsidianInternalPlugins;
        };

        return appWithInternalPlugins.internalPlugins;
    }

    private getDefaultJournalEntryContents(date: string) {
        return '---\ntitle: ' + date + '\n---\n';
    }

    private getSynthesisEntryType(periodType: SynthesisPeriodType): JournalystEntryType {
        if (periodType === 'weekly') {
            return 'weekly-review';
        }

        if (periodType === 'monthly') {
            return 'monthly-reflection';
        }

        return 'quarter-summary';
    }

    private async applyJournalystEntryProperties(file: TFile, context: Parameters<typeof buildJournalystNoteProperties>[0]) {
        if (!this.settings.basesIntegrationEnabled) {
            return;
        }

        const properties = buildJournalystNoteProperties(context);
        await this.applyJournalystPropertiesToFile(file, properties);
    }

    private async applyJournalystPropertiesToFile(file: TFile, properties: ReturnType<typeof buildJournalystNoteProperties>) {
        const contents = await this.app.vault.read(file);
        const nextContents = upsertFrontmatterProperties(contents, properties);

        if (nextContents !== contents) {
            await this.app.vault.modify(file, nextContents);
        }
    }

    private appendPromptBlock(baseContents: string, promptBlock: string) {
        return baseContents.trimEnd() + '\n\n' + promptBlock.trim() + '\n';
    }

    private async appendPromptBlockToFile(file: TFile, promptBlock: string) {
        const contents = await this.app.vault.read(file);
        await this.app.vault.modify(file, this.appendPromptBlock(contents, promptBlock));
    }

    private initializeTemplateStrategies() {
        this.templateStrategies = createTemplateStrategies({
            getCoreTemplatesSettings: () => this.getCoreTemplatesSettings(),
            getMarkdownFilesInFolder: (templateFolder) => this.getMarkdownFilesInFolder(templateFolder),
            getObsidianPlugins: () => this.getObsidianPlugins(),
            getRawCoreTemplateFolder: () => this.getRawCoreTemplateFolder(),
            getRawTemplaterTemplateFolder: () => this.getRawTemplaterTemplateFolder(),
            getTemplaterPlugin: () => this.getTemplaterPlugin(),
            isCoreTemplatesPluginEnabled: () => this.isCoreTemplatesPluginEnabled(),
            readTemplateFile: (templateFile) => this.app.vault.read(templateFile),
            renderCoreTemplate: (templateContents, date, promptContext) => this.renderCoreTemplate(templateContents, date, promptContext),
            serializePromptFrontmatter: (promptContext) => this.serializePromptFrontmatter(promptContext),
            formatJournalNoteBaseName: (date) => this.formatJournalNoteBaseName(date),
            formatJournalNoteFileName: (date) => this.formatJournalNoteFileName(date),
            vaultCreate: (path, contents) => this.app.vault.create(path, contents),
            vaultGetAbstractFileByPath: (path) => this.app.vault.getAbstractFileByPath(path),
        });
    }

    private getTemplateStrategy(templateEngine: TemplateEngine) {
        if (templateEngine === 'none') {
            return null;
        }

        return this.templateStrategies?.[templateEngine] ?? null;
    }

    private getJournalTemplateMap(templateEngine: TemplateEngine) {
        if (templateEngine === 'templater') {
            return this.settings.templaterJournalTemplates;
        }

        if (templateEngine === 'core') {
            return this.settings.coreJournalTemplates;
        }

        return null;
    }

    private remapJournalPaths(oldPath: string, newPath: string) {
        if (this.settings.rootDirectory === oldPath) {
            this.settings.rootDirectory = newPath;
        }

        this.settings.templaterJournalTemplates = this.remapTemplateMapPaths(this.settings.templaterJournalTemplates, oldPath, newPath);
        this.settings.coreJournalTemplates = this.remapTemplateMapPaths(this.settings.coreJournalTemplates, oldPath, newPath);
        this.settings.journalCadenceRevisions = this.remapCadenceTimelinePaths(this.settings.journalCadenceRevisions, oldPath, newPath);
        this.settings.journalSchedulePauses = this.remapSchedulePausePaths(this.settings.journalSchedulePauses, oldPath, newPath);
        if (this.settings.journalCadences) {
            this.settings.journalCadences = this.remapCadenceMapPaths(this.settings.journalCadences, oldPath, newPath);
        }
        this.settings.journalPromptSettings = this.remapPromptSettingsPaths(this.settings.journalPromptSettings, oldPath, newPath);
        this.settings.journalPromptHistory = this.remapPromptHistoryPaths(this.settings.journalPromptHistory, oldPath, newPath);
        this.settings.journalReminderSettings = this.remapReminderSettingsPaths(this.settings.journalReminderSettings, oldPath, newPath);
        this.settings.reminderHistory = this.remapReminderHistoryPaths(this.settings.reminderHistory, oldPath, newPath);

        if (this.reviewState.journalPath === oldPath) {
            this.reviewState.journalPath = newPath;
        } else if (this.reviewState.journalPath?.startsWith(oldPath + '/')) {
            this.reviewState.journalPath = newPath + this.reviewState.journalPath.slice(oldPath.length);
        }
    }

    private async getJournalBackfillItems(journal: TFolder) {
        const items: JournalNotePropertyBackfillItem[] = [];

        for (const child of journal.children) {
            if (!(child instanceof TFile) || child.extension !== 'md') {
                continue;
            }

            const parsedEntryDate = this.parseJournalDateFromFile(child);
            const noteKind: ParsedJournalystNoteKind | null = parsedEntryDate
                ? { date: parsedEntryDate, entryType: 'entry' as JournalystEntryType }
                : parseJournalystNoteKind(child);

            if (!noteKind) {
                continue;
            }

            const desiredProperties = buildJournalystNoteProperties({
                cadence: this.getJournalCadenceAtDate(
                    journal.path,
                    noteKind.periodEnd ?? noteKind.date ?? moment().format('YYYY-MM-DD'),
                ),
                date: noteKind.date,
                entryType: noteKind.entryType,
                journalName: journal.name,
                journalPath: journal.path,
                periodEnd: noteKind.periodEnd,
                periodStart: noteKind.periodStart,
                periodType: noteKind.periodType,
            });
            const currentFrontmatter = await this.getFrontmatterFromFile(child);
            const diff = getFrontmatterPropertyDiff(currentFrontmatter, desiredProperties);

            if (diff.missingKeys.length === 0 && diff.changedKeys.length === 0) {
                continue;
            }

            items.push({
                filePath: child.path,
                journalPath: journal.path,
                journalName: journal.name,
                entryType: noteKind.entryType,
                missingKeys: diff.missingKeys,
                changedKeys: diff.changedKeys,
                properties: desiredProperties,
            });
        }

        return items;
    }

    private async getFrontmatterFromFile(file: TFile) {
        const cachedFrontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (cachedFrontmatter) {
            return cachedFrontmatter as Record<string, unknown>;
        }

        const contents = await this.app.vault.read(file);
        const frontmatterMatch = contents.match(/^---\n([\s\S]*?)\n---\n?/);

        if (!frontmatterMatch) {
            return {};
        }

        try {
            const parsed = parseYaml(frontmatterMatch[1]);
            return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
        } catch {
            return {};
        }
    }

    private buildJournalBasesIntegrationModel(journal: TFolder, backfillCount: number): JournalBasesIntegrationModel {
        const resources: JournalBaseResource[] = (['entries', 'reflections'] as BasesGenerationTarget[]).map(target => {
            const filePath = normalizePath(`${journal.path}/${getJournalystBaseFileName(target)}`);
            const existingFile = this.app.vault.getAbstractFileByPath(filePath);
            return {
                target,
                label: target === 'entries' ? 'Journal entries' : 'Reviews and reflections',
                description: target === 'entries'
                    ? 'Browse dated entries, prompt history, and cadence metadata.'
                    : 'Browse weekly, monthly, and quarterly synthesis notes.',
                filePath,
                status: existingFile instanceof TFile
                    ? 'ready'
                    : existingFile
                        ? 'conflict'
                        : 'missing',
            };
        });
        const globalEnabled = this.isBasesIntegrationEnabled();
        const corePluginAvailable = this.isBasesCorePluginAvailable();
        const readyCount = resources.filter(resource => resource.status === 'ready').length;
        const status = !globalEnabled
            ? 'off'
            : !corePluginAvailable
                ? 'unavailable'
                : readyCount === resources.length
                    ? 'ready'
                    : readyCount > 0
                        ? 'partial'
                        : 'setup-needed';
        const recognizedNoteCount = journal.children.filter(child => (
            child instanceof TFile
            && child.extension === 'md'
            && (!!this.parseJournalDateFromFile(child) || !!parseJournalystNoteKind(child))
        )).length;

        return {
            globalEnabled,
            corePluginAvailable,
            status,
            resources,
            managedProperties: JOURNALYST_BASE_MANAGED_PROPERTIES,
            recognizedNoteCount,
            backfillCount,
        };
    }

    private isBasesCorePluginAvailable() {
        const internalPlugins = this.getObsidianInternalPlugins();
        const basesPlugin = internalPlugins?.getPluginById?.('bases')
            ?? internalPlugins?.plugins?.['bases'];

        if (typeof basesPlugin?.enabled === 'boolean') {
            return basesPlugin.enabled;
        }

        if (typeof basesPlugin?._loaded === 'boolean') {
            return basesPlugin._loaded;
        }

        if (basesPlugin?.instance) {
            return true;
        }

        return true;
    }

    private async ensureManagedBaseFile(journal: TFolder, target: BasesGenerationTarget) {
        const filePath = normalizePath(`${journal.path}/${getJournalystBaseFileName(target)}`);
        const existingFile = this.app.vault.getAbstractFileByPath(filePath);

        if (existingFile instanceof TFile) {
            return false;
        }

        if (existingFile) {
            throw new Error(`${filePath} is occupied by a folder.`);
        }

        await this.app.vault.create(filePath, this.getManagedBaseFileContents(journal, target));
        return true;
    }

    private async writeManagedBaseFile(journal: TFolder, target: BasesGenerationTarget) {
        const filePath = normalizePath(`${journal.path}/${getJournalystBaseFileName(target)}`);
        const existingFile = this.app.vault.getAbstractFileByPath(filePath);
        const contents = this.getManagedBaseFileContents(journal, target);

        if (existingFile instanceof TFile) {
            await this.app.vault.modify(existingFile, contents);
            return;
        }

        if (existingFile) {
            throw new Error(`${filePath} is occupied by a folder.`);
        }

        await this.app.vault.create(filePath, contents);
    }

    private getManagedBaseFileContents(journal: TFolder, target: BasesGenerationTarget) {
        return target === 'entries'
            ? buildEntryBaseContents(journal)
            : buildReflectionBaseContents(journal);
    }

    private showBasesGenerationNotice(createdCount: number, preservedCount: number, journalName?: string) {
        const scope = journalName ? ` for ${journalName}` : '';
        if (createdCount === 0) {
            new Notice(`Journalyst kept ${preservedCount} existing Base file${preservedCount === 1 ? '' : 's'}${scope} unchanged.`);
            return;
        }

        const preservedMessage = preservedCount > 0
            ? ` ${preservedCount} existing file${preservedCount === 1 ? ' was' : 's were'} left unchanged.`
            : '';
        new Notice(`Journalyst created ${createdCount} missing Base file${createdCount === 1 ? '' : 's'}${scope}.${preservedMessage}`);
    }

    private remapTemplateMapPaths(templateMap: Record<string, string>, oldPath: string, newPath: string) {
        const remappedTemplateMap: Record<string, string> = {};

        Object.entries(templateMap).forEach(([journalPath, templatePath]) => {
            if (journalPath === oldPath) {
                remappedTemplateMap[newPath] = templatePath;
                return;
            }

            if (journalPath.startsWith(oldPath + '/')) {
                remappedTemplateMap[newPath + journalPath.slice(oldPath.length)] = templatePath;
                return;
            }

            remappedTemplateMap[journalPath] = templatePath;
        });

        return remappedTemplateMap;
    }

    private remapCadenceMapPaths(cadenceMap: Record<string, JournalCadenceConfig>, oldPath: string, newPath: string) {
        const remappedCadenceMap: Record<string, JournalCadenceConfig> = {};

        Object.entries(cadenceMap).forEach(([journalPath, cadence]) => {
            if (journalPath === oldPath) {
                remappedCadenceMap[newPath] = cadence;
                return;
            }

            if (journalPath.startsWith(oldPath + '/')) {
                remappedCadenceMap[newPath + journalPath.slice(oldPath.length)] = cadence;
                return;
            }

            remappedCadenceMap[journalPath] = cadence;
        });

        return remappedCadenceMap;
    }

    private remapCadenceTimelinePaths(cadenceMap: Record<string, JournalCadenceRevision[]>, oldPath: string, newPath: string) {
        const remappedCadenceMap: Record<string, JournalCadenceRevision[]> = {};

        Object.entries(cadenceMap).forEach(([journalPath, timeline]) => {
            if (journalPath === oldPath) {
                remappedCadenceMap[newPath] = timeline;
                return;
            }

            if (journalPath.startsWith(oldPath + '/')) {
                remappedCadenceMap[newPath + journalPath.slice(oldPath.length)] = timeline;
                return;
            }

            remappedCadenceMap[journalPath] = timeline;
        });

        return remappedCadenceMap;
    }

    private remapSchedulePausePaths(pauseMap: Record<string, JournalSchedulePause[]>, oldPath: string, newPath: string) {
        const remappedPauseMap: Record<string, JournalSchedulePause[]> = {};

        Object.entries(pauseMap).forEach(([journalPath, pauses]) => {
            if (journalPath === oldPath) {
                remappedPauseMap[newPath] = pauses;
                return;
            }

            if (journalPath.startsWith(oldPath + '/')) {
                remappedPauseMap[newPath + journalPath.slice(oldPath.length)] = pauses;
                return;
            }

            remappedPauseMap[journalPath] = pauses;
        });

        return remappedPauseMap;
    }

    private remapPromptSettingsPaths(promptSettingsMap: Record<string, JournalPromptSettings>, oldPath: string, newPath: string) {
        const remappedPromptSettingsMap: Record<string, JournalPromptSettings> = {};

        Object.entries(promptSettingsMap).forEach(([journalPath, promptSettings]) => {
            if (journalPath === oldPath) {
                remappedPromptSettingsMap[newPath] = promptSettings;
                return;
            }

            if (journalPath.startsWith(oldPath + '/')) {
                remappedPromptSettingsMap[newPath + journalPath.slice(oldPath.length)] = promptSettings;
                return;
            }

            remappedPromptSettingsMap[journalPath] = promptSettings;
        });

        return remappedPromptSettingsMap;
    }

    private remapPromptHistoryPaths(promptHistoryMap: Record<string, JournalPromptHistory>, oldPath: string, newPath: string) {
        const remappedPromptHistoryMap: Record<string, JournalPromptHistory> = {};

        Object.entries(promptHistoryMap).forEach(([journalPath, promptHistory]) => {
            if (journalPath === oldPath) {
                remappedPromptHistoryMap[newPath] = promptHistory;
                return;
            }

            if (journalPath.startsWith(oldPath + '/')) {
                remappedPromptHistoryMap[newPath + journalPath.slice(oldPath.length)] = promptHistory;
                return;
            }

            remappedPromptHistoryMap[journalPath] = promptHistory;
        });

        return remappedPromptHistoryMap;
    }

    private remapReminderSettingsPaths(reminderSettingsMap: Record<string, JournalReminderSettings>, oldPath: string, newPath: string) {
        const remappedReminderSettingsMap: Record<string, JournalReminderSettings> = {};

        Object.entries(reminderSettingsMap).forEach(([journalPath, reminderSettings]) => {
            if (journalPath === oldPath) {
                remappedReminderSettingsMap[newPath] = reminderSettings;
                return;
            }

            if (journalPath.startsWith(oldPath + '/')) {
                remappedReminderSettingsMap[newPath + journalPath.slice(oldPath.length)] = reminderSettings;
                return;
            }

            remappedReminderSettingsMap[journalPath] = reminderSettings;
        });

        return remappedReminderSettingsMap;
    }

    private remapReminderHistoryPaths(reminderHistoryMap: Record<string, ReminderOccurrenceRecord>, oldPath: string, newPath: string) {
        const remappedReminderHistoryMap: Record<string, ReminderOccurrenceRecord> = {};

        Object.values(reminderHistoryMap).forEach(record => {
            const nextJournalPath = record.journalPath === oldPath
                ? newPath
                : record.journalPath.startsWith(oldPath + '/')
                    ? newPath + record.journalPath.slice(oldPath.length)
                    : record.journalPath;
            const historyKey = buildReminderHistoryKey(nextJournalPath, record.ruleKey, record.occurrenceKey);
            remappedReminderHistoryMap[historyKey] = {
                ...record,
                journalPath: nextJournalPath,
            };
        });

        return remappedReminderHistoryMap;
    }

    private async getCoreTemplatesSettings() {
        return this.readConfigJson<CoreTemplatesSettings>('templates.json');
    }

    private getRawTemplaterTemplateFolder() {
        const templateFolder = this.getTemplaterPlugin()?.settings?.templates_folder?.trim().replace(/\/$/, '');

        return templateFolder || null;
    }

    private async getRawCoreTemplateFolder() {
        const coreTemplatesSettings = await this.getCoreTemplatesSettings();
        const templateFolder = coreTemplatesSettings?.folder
            ?? coreTemplatesSettings?.templateFolder
            ?? coreTemplatesSettings?.templates_folder;

        const normalizedTemplateFolder = templateFolder?.trim().replace(/\/$/, '');

        if (!normalizedTemplateFolder || normalizedTemplateFolder === '/') {
            return null;
        }

        return normalizedTemplateFolder;
    }

    private isCoreTemplatesPluginEnabled() {
        const internalPlugins = this.getObsidianInternalPlugins();
        const coreTemplatesPlugin = internalPlugins?.getPluginById?.('templates')
            ?? internalPlugins?.plugins?.['templates'];

        if (typeof coreTemplatesPlugin?.enabled === 'boolean') {
            return coreTemplatesPlugin.enabled;
        }

        if (typeof coreTemplatesPlugin?._loaded === 'boolean') {
            return coreTemplatesPlugin._loaded;
        }

        if (coreTemplatesPlugin?.instance) {
            return true;
        }

        return true;
    }

    private async readConfigJson<T>(configFileName: string): Promise<T | null> {
        const configPath = normalizePath(this.app.vault.configDir + '/' + configFileName);

        if (!await this.app.vault.adapter.exists(configPath)) {
            return null;
        }

        try {
            const rawContents = await this.app.vault.adapter.read(configPath);
            return JSON.parse(rawContents) as T;
        } catch (error) {
            console.error(`Journalyst failed to read ${configFileName}.`, error);
            return null;
        }
    }

    private async renderCoreTemplate(templateContents: string, date: string, promptContext?: TemplatePromptContext | null) {
        const coreTemplateSettings = await this.getCoreTemplatesSettings();
        const defaultDateFormat = coreTemplateSettings?.dateFormat || 'YYYY-MM-DD';
        const defaultTimeFormat = coreTemplateSettings?.timeFormat || 'HH:mm';

        return templateContents.replace(/{{\s*(title|date|time|prompt|promptTitle)(?::([^}]+))?\s*}}/g, (_match, variable: string, explicitFormat?: string) => {
            if (variable === 'title') {
                return date;
            }

            if (variable === 'prompt') {
                return promptContext?.prompt ?? '';
            }

            if (variable === 'promptTitle') {
                return promptContext?.promptTitle ?? '';
            }

            const format = explicitFormat?.trim() || (variable === 'date' ? defaultDateFormat : defaultTimeFormat);
            return moment().format(format);
        });
    }

    private serializePromptFrontmatter(promptContext: TemplatePromptContext) {
        const formatValue = (value: string) => {
            const lines = value.replace(/\r\n/g, '\n').split('\n');
            if (lines.length === 1) {
                return JSON.stringify(value);
            }

            return `|-\n${lines.map(line => `  ${line}`).join('\n')}`;
        };

        return [
            '---',
            `journalyst_prompt: ${formatValue(promptContext.prompt)}`,
            `journalyst_prompt_title: ${formatValue(promptContext.promptTitle)}`,
            '---',
            '',
        ].join('\n');
    }

    private getMarkdownFilesInFolder(templateFolder: string) {
        const normalizedTemplateFolder = normalizePath(templateFolder);
        const templateFolderPrefix = normalizedTemplateFolder === '/' ? '' : normalizedTemplateFolder + '/';

        return this.app.vault.getMarkdownFiles()
            .filter(file => file.path.startsWith(templateFolderPrefix));
    }

    async activateView() {
        await this.activateReviewView(undefined, undefined, 'home');
    }

    async activateSidebarView(sidebarMode?: SidebarMode) {
        const { workspace } = this.app;

        if (sidebarMode && this.settings.sidebarMode !== sidebarMode) {
            this.settings.sidebarMode = sidebarMode;
            await this.saveSettings();
        }

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_SIDE_BAR);

        if (leaves.length > 0) {
            // A leaf with our view already exists, use that
            leaf = leaves[0];
        } else {
            // Our view could not be found in the workspace, create a new leaf
            // in the right sidebar for it
            leaf = workspace.getRightLeaf(false);
            if (!leaf) {
                return;
            }
            await leaf.setViewState({ type: VIEW_TYPE_SIDE_BAR, active: true });
        }

        if (leaf.view instanceof SideBarView) {
            leaf.view.renderView();
        }

        // "Reveal" the leaf in case it is in a collapsed sidebar
        workspace.revealLeaf(leaf);
    }

    async activateReviewView(
        journalPath?: string | null,
        anchorDate?: string,
        activeTab?: ReviewWorkspaceTab,
        journalSettingsSection?: JournalSettingsSection,
    ) {
        const { workspace } = this.app;
        const resolvedAnchorDate = anchorDate ?? moment().format('YYYY-MM-DD');
        const targetJournalPath = journalPath ?? this.inferCurrentJournal()?.path ?? this.getDefaultReviewJournalPath();
        await this.setReviewState(targetJournalPath, resolvedAnchorDate, activeTab, journalSettingsSection);

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_REVIEW);

        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            leaf = workspace.getLeaf(true);
            if (!leaf) {
                return;
            }
            await leaf.setViewState({ type: VIEW_TYPE_REVIEW, active: true });
        }

        const reviewView = leaf.view;
        if (reviewView instanceof ReviewView) {
            reviewView.updateReviewState(targetJournalPath, resolvedAnchorDate, activeTab, journalSettingsSection);
        }

        workspace.revealLeaf(leaf);
    }

    async activateJournalSettings(journalPath?: string | null, section: JournalSettingsSection = 'schedule') {
        await this.activateReviewView(journalPath, undefined, 'journals', section);
    }

    private refreshSidebarView() {
        const sideBarLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_SIDE_BAR);

        sideBarLeaves.forEach(leaf => {
            if (leaf.view instanceof SideBarView) {
                leaf.view.renderView();
            }
        });
    }


    async loadSettings() {
        const loadedData: unknown = await this.loadData();
        const storedSettings = loadedData && typeof loadedData === 'object'
            ? loadedData as Partial<JournalystPluginSettings>
            : null;
        const storedOnboarding = storedSettings?.onboarding;

        this.hadStoredRootDirectory = typeof storedSettings?.rootDirectory === 'string';
        this.onboardingNeedsMigration = !isCurrentOnboardingSettings(storedOnboarding);
        this.settings = Object.assign({}, DEFAULT_SETTINGS, storedSettings ?? {});
        this.settings.rootDirectory = typeof storedSettings?.rootDirectory === 'string'
            ? storedSettings.rootDirectory
            : null;
        this.settings.onboarding = normalizeOnboardingSettings(storedOnboarding);
        // Older installs stored a single journalTemplates map before engine-specific
        // settings existed. Preserve those choices by migrating them into the
        // templater map on load.
        this.settings.templaterJournalTemplates = this.settings.templaterJournalTemplates ?? this.settings.journalTemplates ?? {};
        this.settings.basesIntegrationEnabled = this.settings.basesIntegrationEnabled ?? false;
        this.settings.remindersEnabled = this.settings.remindersEnabled ?? false;
        this.settings.osNotificationsEnabled = this.settings.osNotificationsEnabled ?? false;
        this.settings.reminderQuietHours = normalizeReminderQuietHours(this.settings.reminderQuietHours);
        this.settings.sidebarMode = this.settings.sidebarMode ?? 'journals-mini';
        this.settings.coreJournalTemplates = this.settings.coreJournalTemplates ?? {};
        this.settings.noteDateFormat = this.settings.noteDateFormat ?? 'YYYY-MM-DD';
        this.settings.noteDateFormatHistory = this.settings.noteDateFormatHistory ?? [];
        this.settings.journalCadenceRevisions = Object.fromEntries(
            Object.entries(this.settings.journalCadenceRevisions ?? {})
                .map(([journalPath, timeline]) => [journalPath, normalizeJournalCadenceTimeline(timeline)])
        );
        this.settings.journalSchedulePauses = Object.fromEntries(
            Object.entries(this.settings.journalSchedulePauses ?? {})
                .map(([journalPath, pauses]) => [journalPath, normalizeJournalSchedulePauses(pauses)])
        );
        this.settings.journalCadences = this.settings.journalCadences ?? {};
        this.settings.customPromptLists = this.settings.customPromptLists ?? {};
        this.settings.journalPromptSettings = Object.fromEntries(
            Object.entries(this.settings.journalPromptSettings ?? {})
                .map(([journalPath, promptSettings]) => [
                    journalPath,
                    normalizeJournalPromptSettings(promptSettings),
                ]),
        );
        this.settings.journalPromptHistory = Object.fromEntries(
            Object.entries(this.settings.journalPromptHistory ?? {})
                .map(([journalPath, promptHistory]) => [
                    journalPath,
                    normalizeJournalPromptHistory(promptHistory),
                ]),
        );
        this.settings.journalReminderSettings = this.settings.journalReminderSettings ?? {};
        this.settings.reminderHistory = this.settings.reminderHistory ?? {};
        this.settings.journalEntryBaselines = Object.fromEntries(
            Object.entries(this.settings.journalEntryBaselines ?? {})
                .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
        );
        this.settings.templateEngine = this.settings.templateEngine ?? 'templater';
        this.settings.templateFailureBehavior = this.settings.templateFailureBehavior ?? 'fallback-default';
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

    private async resolvePromptForJournal(journalPath: string, date: string): Promise<{ resolvedPrompt: ResolvedPrompt | null; error?: string | null }> {
        const promptSettings = this.getJournalPromptSettings(journalPath);
        const promptHistory = this.settings.journalPromptHistory[journalPath];
        const result = await resolvePromptForJournal(promptSettings, promptHistory, date, this.getPromptResolveContext());

        return {
            resolvedPrompt: result.resolvedPrompt,
            error: result.error,
        };
    }

    private getPromptResolveContext() {
        return {
            customPromptLists: this.settings.customPromptLists,
            getFileByPath: (path: string) => {
                const file = this.app.vault.getAbstractFileByPath(path);
                return file instanceof TFile ? file : null;
            },
            readFile: (file: TFile) => this.app.vault.read(file),
        };
    }

    private getPromptHistoryIdentity(promptSettings: JournalPromptSettings) {
        const normalized = normalizeJournalPromptSettings(promptSettings);
        return JSON.stringify({
            sourceKey: getPromptSourceKey(getPromptSourceSelection(normalized)),
            selectionMode: normalized.selectionMode,
            staticPromptId: normalized.staticPromptId,
            weekdayOverrides: normalized.weekdayOverrides,
            weekdaySourceOverrides: normalized.weekdaySourceOverrides,
        });
    }

    private registerJournalSettingsUndo(input: JournalSettingsUndoInput) {
        const token = crypto.randomUUID();
        this.journalSettingsUndo = { ...input, token } as JournalSettingsUndoRecord;
        return token;
    }

    private captureScheduleUndoSnapshot(journalPath: string): JournalScheduleUndoSnapshot {
        const timeline = this.settings.journalCadenceRevisions[journalPath];
        return {
            hadTimeline: Object.hasOwn(this.settings.journalCadenceRevisions, journalPath),
            timeline: cloneSettingsValue(timeline ?? []),
            records: this.captureReminderHistoryForJournal(journalPath),
        };
    }

    private applyScheduleUndoSnapshot(journalPath: string, snapshot: JournalScheduleUndoSnapshot) {
        if (snapshot.hadTimeline) {
            this.settings.journalCadenceRevisions[journalPath] = cloneSettingsValue(snapshot.timeline);
        } else {
            delete this.settings.journalCadenceRevisions[journalPath];
        }
        this.applyReminderHistoryForJournal(journalPath, snapshot.records);
    }

    private captureEntrySetupUndoSnapshot(journalPath: string): JournalEntrySetupUndoSnapshot {
        const templateEngine = this.settings.templateEngine;
        const templateMap = this.getJournalTemplateMap(templateEngine);
        const promptSettings = this.settings.journalPromptSettings[journalPath];
        const promptHistory = this.settings.journalPromptHistory[journalPath];
        return {
            templateEngine,
            hadTemplatePath: !!templateMap && Object.hasOwn(templateMap, journalPath),
            templatePath: templateMap?.[journalPath] ?? null,
            hadPromptSettings: Object.hasOwn(this.settings.journalPromptSettings, journalPath),
            promptSettings: cloneSettingsValue(promptSettings ?? this.getJournalPromptSettings(journalPath)),
            hadPromptHistory: Object.hasOwn(this.settings.journalPromptHistory, journalPath),
            promptHistory: promptHistory ? cloneSettingsValue(promptHistory) : null,
        };
    }

    private applyEntrySetupUndoSnapshot(journalPath: string, snapshot: JournalEntrySetupUndoSnapshot) {
        const templateMap = this.getJournalTemplateMap(snapshot.templateEngine);
        if (templateMap) {
            if (snapshot.hadTemplatePath && snapshot.templatePath) {
                templateMap[journalPath] = snapshot.templatePath;
            } else {
                delete templateMap[journalPath];
            }
        }

        if (snapshot.hadPromptSettings) {
            this.settings.journalPromptSettings[journalPath] = cloneSettingsValue(snapshot.promptSettings);
        } else {
            delete this.settings.journalPromptSettings[journalPath];
        }
        if (snapshot.hadPromptHistory && snapshot.promptHistory) {
            this.settings.journalPromptHistory[journalPath] = cloneSettingsValue(snapshot.promptHistory);
        } else {
            delete this.settings.journalPromptHistory[journalPath];
        }
    }

    private captureReminderUndoSnapshot(journalPath: string): JournalReminderUndoSnapshot {
        const settings = this.settings.journalReminderSettings[journalPath];
        return {
            hadSettings: Object.hasOwn(this.settings.journalReminderSettings, journalPath),
            settings: cloneSettingsValue(settings ?? this.getJournalReminderSettings(journalPath)),
            records: this.captureReminderHistoryForJournal(journalPath),
        };
    }

    private applyReminderUndoSnapshot(journalPath: string, snapshot: JournalReminderUndoSnapshot) {
        if (snapshot.hadSettings) {
            this.settings.journalReminderSettings[journalPath] = cloneSettingsValue(snapshot.settings);
        } else {
            delete this.settings.journalReminderSettings[journalPath];
        }
        this.applyReminderHistoryForJournal(journalPath, snapshot.records);
    }

    private captureReminderHistoryForJournal(journalPath: string) {
        return cloneSettingsValue(Object.fromEntries(
            Object.entries(this.settings.reminderHistory)
                .filter(([, record]) => record.journalPath === journalPath),
        ));
    }

    private applyReminderHistoryForJournal(
        journalPath: string,
        records: Record<string, ReminderOccurrenceRecord>,
    ) {
        this.clearReminderHistoryForJournal(journalPath);
        Object.assign(this.settings.reminderHistory, cloneSettingsValue(records));
    }

    private isJournalSettingsUndoCurrent(record: JournalSettingsUndoRecord) {
        if (record.section === 'schedule') {
            return JSON.stringify(this.captureScheduleUndoSnapshot(record.journalPath)) === JSON.stringify(record.after);
        }
        if (record.section === 'entry-setup') {
            return JSON.stringify(this.captureEntrySetupUndoSnapshot(record.journalPath)) === JSON.stringify(record.after);
        }
        return JSON.stringify(this.captureReminderUndoSnapshot(record.journalPath)) === JSON.stringify(record.after);
    }

    private applyJournalSettingsUndoSnapshot(
        record: JournalSettingsUndoRecord,
        position: 'before' | 'after',
    ) {
        if (record.section === 'schedule') {
            this.applyScheduleUndoSnapshot(record.journalPath, record[position]);
        } else if (record.section === 'entry-setup') {
            this.applyEntrySetupUndoSnapshot(record.journalPath, record[position]);
        } else {
            this.applyReminderUndoSnapshot(record.journalPath, record[position]);
        }
    }

    private getJournalEntrySetupValue(journalPath: string): JournalEntrySetupUpdate {
        const templateEngine = this.settings.templateEngine;
        return {
            templatePath: this.getJournalTemplatePath(templateEngine, journalPath) ?? null,
            promptSettings: this.getJournalPromptSettings(journalPath),
        };
    }

    private getJournalAutosaveValue(
        section: JournalAutosaveSection,
        journalPath: string,
    ): JournalAutosaveValue {
        if (section === 'schedule') return this.getJournalCadence(journalPath);
        if (section === 'entry-setup') return this.getJournalEntrySetupValue(journalPath);
        return this.getJournalReminderSettings(journalPath);
    }

    private async refreshJournalAutosaveEffects(section: JournalAutosaveSection, journalPath: string) {
        if (section === 'schedule' && this.isBasesIntegrationEnabled()) {
            const journal = this.getJournalByPath(journalPath);
            if (journal) {
                try {
                    await this.applyJournalNotePropertyBackfill(await this.getJournalBackfillItems(journal));
                } catch (error) {
                    console.error('Journalyst could not refresh cadence properties after undoing the schedule.', error);
                    new Notice('The schedule was restored, but some managed Bases properties could not be refreshed.');
                }
            }
        }
        if (section === 'schedule' || section === 'reminders') {
            try {
                await this.checkReminderNotifications(true);
            } catch (error) {
                console.error('Journalyst could not refresh reminders after undoing journal settings.', error);
            }
        }
        this.refreshCompletionViews();
    }

    private doesTemplateEngineSupportPromptContext(templateEngine: TemplateEngine) {
        return templateEngine === 'core' || templateEngine === 'templater';
    }

    private clearReminderHistoryForJournal(journalPath: string) {
        Object.keys(this.settings.reminderHistory).forEach(historyKey => {
            if (this.settings.reminderHistory[historyKey]?.journalPath === journalPath) {
                delete this.settings.reminderHistory[historyKey];
            }
        });
    }
}

function cloneSettingsValue<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}
