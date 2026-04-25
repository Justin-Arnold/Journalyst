import { Notice, Plugin, TAbstractFile, TFile, TFolder, normalizePath, WorkspaceLeaf, moment, parseYaml } from 'obsidian';
import {
    BasesGenerationTarget,
    buildEntryBaseContents,
    buildJournalystNoteProperties,
    buildReflectionBaseContents,
    getFrontmatterPropertyDiff,
    getJournalystBaseFileName,
    JournalNotePropertyBackfillItem,
    JournalystEntryType,
    parseJournalystNoteKind,
    upsertFrontmatterProperties,
} from "./bases";
import { JournalCadenceConfig, normalizeJournalCadence } from "./cadence";
import { BUILT_IN_PROMPT_LISTS } from "./promptLibrary";
import {
    createCustomPromptListDefinition,
    createPromptBlock,
    getPromptTemplateContext,
    JournalPromptHistory,
    JournalPromptSettings,
    normalizeJournalPromptSettings,
    PromptListDefinition,
    ResolvedPrompt,
    resolvePromptForJournal,
    resolvePromptList,
} from "./prompts";
import {
    buildReminderHistoryKey,
    buildSynthesisReminderFileName,
    getReminderEventsForJournal,
    hasAnyEnabledReminder,
    JournalReminderSettings,
    normalizeJournalReminderSettings,
    ReminderOccurrenceRecord,
    ResolvedReminderEvent,
    ReviewReminderPeriod,
} from "./reminders";
import { buildSynthesisNotePreview } from "./review/buildSnapshot";
import { ReviewWorkspaceTab, SidebarMode, SynthesisPeriodType } from "./review/types";
import { createTemplateStrategies } from "./templates/strategies";
import {
    buildJournalMigrationPlan,
    findJournalEntryFile,
    formatJournalNoteBaseName,
    formatJournalNoteFileName,
    JournalNoteMigrationItem,
    parseJournalDateFromFile,
} from "./journalNaming";
import {
    CoreTemplatesSettings,
    JournalTemplateEngineStrategy,
    ObsidianInternalPlugins,
    ObsidianPlugins,
    TemplateAvailability,
    TemplateEngine,
    TemplateFailureBehavior,
    TemplaterPlugin,
    TemplatePromptContext,
} from "./templates/types";
import { ReviewView, VIEW_TYPE_REVIEW } from "./views/Review";
import { SideBarView, VIEW_TYPE_SIDE_BAR } from "./views/SideBar";
import { JournalystSettingsTab } from "./views/Settings";

export interface JournalystPluginSettings {
    rootDirectory: string;
    basesIntegrationEnabled: boolean;
    remindersEnabled: boolean;
    osNotificationsEnabled: boolean;
    sidebarMode: SidebarMode;
    noteDateFormat: string;
    noteDateFormatHistory: string[];
    journalCadences: Record<string, JournalCadenceConfig>;
    customPromptLists: Record<string, PromptListDefinition>;
    journalPromptSettings: Record<string, JournalPromptSettings>;
    journalPromptHistory: Record<string, JournalPromptHistory>;
    journalReminderSettings: Record<string, JournalReminderSettings>;
    reminderHistory: Record<string, ReminderOccurrenceRecord>;
    templateEngine: TemplateEngine;
    templateFailureBehavior: TemplateFailureBehavior;
    templaterJournalTemplates: Record<string, string>;
    coreJournalTemplates: Record<string, string>;
    journalTemplates?: Record<string, string>;
}

const DEFAULT_SETTINGS: JournalystPluginSettings = {
	rootDirectory: '/',
    basesIntegrationEnabled: false,
    remindersEnabled: false,
    osNotificationsEnabled: false,
    sidebarMode: 'journals-mini',
    noteDateFormat: 'YYYY-MM-DD',
    noteDateFormatHistory: [],
    journalCadences: {},
    customPromptLists: {},
    journalPromptSettings: {},
    journalPromptHistory: {},
    journalReminderSettings: {},
    reminderHistory: {},
    templateEngine: 'templater',
    templateFailureBehavior: 'fallback-default',
    templaterJournalTemplates: {},
    coreJournalTemplates: {},
}


export default class JournalystPlugin extends Plugin {
	settings: JournalystPluginSettings;
    journals: TFolder[] = [];
    private journalCommandIds: string[] = [];
    // Strategy instances keep engine-specific behavior out of the main plugin flow.
    private templateStrategies: Partial<Record<Exclude<TemplateEngine, 'none'>, JournalTemplateEngineStrategy>>;
    private lastReminderCheckMinute: string | null = null;
    private reviewState: { journalPath: string | null; anchorDate: string; activeTab: ReviewWorkspaceTab } = {
        journalPath: null,
        anchorDate: moment().format('YYYY-MM-DD'),
        activeTab: 'home',
    };

	async onload() {
		await this.loadSettings();
        this.initializeTemplateStrategies();
        this.addSettingTab(new JournalystSettingsTab(this.app, this));

		this.addRibbonIcon('notebook-pen', 'Go to Journalyst view', () => {
            this.activateView();
        });
        this.addRibbonIcon('notebook', 'Open Journalyst sidebar', () => {
            this.activateSidebarView();
        });

        this.app.workspace.onLayoutReady(() => {
            this.refreshJournals();

            this.registerView(
                VIEW_TYPE_SIDE_BAR,
                (leaf) => new SideBarView(leaf, this)
            );
            this.registerView(
                VIEW_TYPE_REVIEW,
                (leaf) => new ReviewView(leaf, this)
            );

            void this.checkReminderNotifications();
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
            this.app.vault.on('create', (item) => this.onItemChange())
        );
        this.registerEvent(
            this.app.vault.on('delete', (item) => this.onItemChange())
        );
        this.registerEvent(
            this.app.vault.on('rename', (item, oldPath) => {
                void this.onItemRename(item, oldPath);
            })
        );
    };

	onunload() {}

    private onItemChange() {
        this.refreshJournals();
    }

    private async onItemRename(item: TAbstractFile, oldPath: string) {
        if (item instanceof TFolder) {
            this.remapJournalPaths(oldPath, item.path);
            await this.saveSettings();
        }

        this.refreshJournals();
    }

    refreshJournals() {
        const rootFolder = this.app.vault.getAbstractFileByPath(this.settings.rootDirectory);

        // Journal commands are derived from folders under the configured root, so
        // rebuild them whenever the root changes or the vault structure changes.
        this.journalCommandIds.forEach(commandId => this.removeCommand(commandId));
        this.journalCommandIds = [];
        this.journals = [];

        if (!(rootFolder instanceof TFolder)) {
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

    private addJournalCommand(journal: TFolder, index: number) {
        const commandId = 'create-journal-' + index + '-' + journal.path.replace(/[^a-zA-Z0-9-]/g, '-');
        this.journalCommandIds.push(commandId);

        this.addCommand({
            id: commandId,
            name: 'Create new journal in ' + journal.name,
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
        const promptBlock = resolvedPrompt && (!promptTemplateMode || !supportsPromptVariables)
            ? createPromptBlock(resolvedPrompt)
            : '';

        if (resolvedPrompt && promptTemplateMode && !supportsPromptVariables) {
            new Notice('This template engine cannot receive prompt variables directly, so Journalyst appended the prompt to the note body instead.');
        }

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
            const baseContents = this.getDefaultJournalEntryContents(date);
            const nextContents = promptBlock ? this.appendPromptBlock(baseContents, promptBlock) : baseContents;
            file = await this.app.vault.create(fullPath, nextContents);
        } else if (promptBlock) {
            await this.appendPromptBlockToFile(file, promptBlock);
        }

        await this.applyJournalystEntryProperties(file, {
            cadence: this.getJournalCadence(journalFolder.path),
            date,
            entryType: 'entry',
            journalName: journalFolder.name,
            journalPath: journalFolder.path,
            promptSettings: this.getJournalPromptSettings(journalFolder.path),
            promptTitle: resolvedPrompt?.prompt.title ?? null,
        });

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

    getJournalCadence(journalPath: string) {
        return normalizeJournalCadence(this.settings.journalCadences[journalPath]);
    }

    async updateJournalCadence(journalPath: string, cadence: JournalCadenceConfig) {
        this.settings.journalCadences[journalPath] = normalizeJournalCadence(cadence);
        await this.saveSettings();
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
        const previousSourceKey = this.getPromptSourceKey(previousSettings);
        const nextSourceKey = this.getPromptSourceKey(normalizedSettings);

        this.settings.journalPromptSettings[journalPath] = normalizedSettings;

        if (previousSourceKey !== nextSourceKey || previousSettings.selectionMode !== normalizedSettings.selectionMode) {
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
            if (promptSettings.sourceType === 'custom' && promptSettings.selectedListId === listId) {
                this.settings.journalPromptSettings[journalPath] = normalizeJournalPromptSettings({
                    ...promptSettings,
                    enabled: false,
                    selectedListId: undefined,
                    staticPromptId: undefined,
                    weekdayOverrides: {},
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

    async getPromptPreview(journalPath: string, limit = 3) {
        const resolvedList = await this.getResolvedPromptList(journalPath);
        return resolvedList?.prompts.slice(0, limit) ?? [];
    }

    async getPromptSettingsStatus(journalPath: string) {
        const promptSettings = this.getJournalPromptSettings(journalPath);

        if (!promptSettings.enabled) {
            return null;
        }

        const resolvedList = await this.getResolvedPromptList(journalPath);
        if (!resolvedList || resolvedList.prompts.length === 0) {
            return 'No prompts are available from the selected source.';
        }

        if (promptSettings.deliveryMode === 'template-variables' && this.settings.templateEngine === 'templater') {
            return 'Templater prompt variables are exposed as tp.frontmatter.journalyst_prompt and tp.frontmatter.journalyst_prompt_title.';
        }

        if (promptSettings.deliveryMode === 'template-variables' && !this.doesTemplateEngineSupportPromptContext(this.settings.templateEngine)) {
            return 'This template engine cannot receive prompt variables directly. Journalyst will append the prompt to the note body instead.';
        }

        return null;
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
        this.settings.journalReminderSettings[journalPath] = normalizeJournalReminderSettings(reminderSettings);
        this.clearReminderHistoryForJournal(journalPath);
        await this.saveSettings();
        await this.checkReminderNotifications(true);
    }

    getJournalReminderSummary(journalPath: string) {
        if (!this.settings.remindersEnabled) {
            return 'Reminders off';
        }

        const cadence = this.getJournalCadence(journalPath);
        const reminderSettings = this.getJournalReminderSettings(journalPath);

        return hasAnyEnabledReminder(reminderSettings, cadence) ? 'Reminders active' : 'Reminders off';
    }

    async setReviewState(journalPath: string | null, anchorDate: string, activeTab?: ReviewWorkspaceTab) {
        this.reviewState = {
            journalPath,
            anchorDate,
            activeTab: activeTab ?? this.reviewState.activeTab,
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
    }

    async generateBasesForJournal(journal: TFolder | string) {
        if (!this.settings.basesIntegrationEnabled) {
            new Notice('Enable Bases integration in Journalyst settings first.');
            return;
        }

        const resolvedJournal = typeof journal === 'string' ? this.getJournalByPath(journal) : journal;

        if (!resolvedJournal) {
            new Notice('Journalyst could not find that journal for Bases generation.');
            return;
        }

        await this.upsertManagedBaseFile(resolvedJournal, 'entries');
        await this.upsertManagedBaseFile(resolvedJournal, 'reflections');
        new Notice(`Journalyst generated Bases for ${resolvedJournal.name}.`);
    }

    async generateBasesForAllJournals() {
        if (!this.settings.basesIntegrationEnabled) {
            new Notice('Enable Bases integration in Journalyst settings first.');
            return;
        }

        for (const journal of this.journals) {
            await this.upsertManagedBaseFile(journal, 'entries');
            await this.upsertManagedBaseFile(journal, 'reflections');
        }

        new Notice(`Journalyst generated Bases for ${this.journals.length} journal${this.journals.length === 1 ? '' : 's'}.`);
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

        const preview = buildSynthesisNotePreview(journal, anchorDate, this.settings, periodType);
        const filePath = normalizePath(journal.path + '/' + preview.payload.fileName);
        const existingFile = this.app.vault.getAbstractFileByPath(filePath);

        if (existingFile instanceof TFile) {
            await this.app.workspace.openLinkText(existingFile.path, '/', false);
            return existingFile;
        }

        const file = await this.app.vault.create(filePath, preview.payload.body);
        await this.applyJournalystEntryProperties(file, {
            cadence: this.getJournalCadence(journal.path),
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

    private getReminderEventsForJournal(journal: TFolder, now: moment.Moment) {
        const entryDates = journal.children
            .map(file => this.parseJournalDateFromFile(file))
            .filter((date): date is string => !!date);

        return getReminderEventsForJournal({
            cadence: this.getJournalCadence(journal.path),
            dateSet: new Set(entryDates),
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
        this.settings.journalCadences = this.remapCadenceMapPaths(this.settings.journalCadences, oldPath, newPath);
        this.settings.journalPromptSettings = this.remapPromptSettingsPaths(this.settings.journalPromptSettings, oldPath, newPath);
        this.settings.journalPromptHistory = this.remapPromptHistoryPaths(this.settings.journalPromptHistory, oldPath, newPath);
        this.settings.journalReminderSettings = this.remapReminderSettingsPaths(this.settings.journalReminderSettings, oldPath, newPath);
        this.settings.reminderHistory = this.remapReminderHistoryPaths(this.settings.reminderHistory, oldPath, newPath);
    }

    private async getJournalBackfillItems(journal: TFolder) {
        const items: JournalNotePropertyBackfillItem[] = [];

        for (const child of journal.children) {
            if (!(child instanceof TFile) || child.extension !== 'md') {
                continue;
            }

            const parsedEntryDate = this.parseJournalDateFromFile(child);
            const noteKind = parsedEntryDate
                ? { date: parsedEntryDate, entryType: 'entry' as JournalystEntryType }
                : parseJournalystNoteKind(child);

            if (!noteKind) {
                continue;
            }

            const desiredProperties = buildJournalystNoteProperties({
                cadence: this.getJournalCadence(journal.path),
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
        const contents = await this.app.vault.read(file);
        const frontmatterMatch = contents.match(/^---\n([\s\S]*?)\n---\n?/);

        if (!frontmatterMatch) {
            return {};
        }

        try {
            const parsed = parseYaml(frontmatterMatch[1]);
            return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
        } catch (_error) {
            return {};
        }
    }

    private async upsertManagedBaseFile(journal: TFolder, target: BasesGenerationTarget) {
        const fileName = getJournalystBaseFileName(target);
        const filePath = normalizePath(`${journal.path}/${fileName}`);
        const contents = target === 'entries'
            ? buildEntryBaseContents(journal)
            : buildReflectionBaseContents(journal);
        const existingFile = this.app.vault.getAbstractFileByPath(filePath);

        if (existingFile instanceof TFile) {
            await this.app.vault.modify(existingFile, contents);
            return existingFile;
        }

        return this.app.vault.create(filePath, contents);
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

    async activateReviewView(journalPath?: string | null, anchorDate?: string, activeTab?: ReviewWorkspaceTab) {
        const { workspace } = this.app;
        const resolvedAnchorDate = anchorDate ?? moment().format('YYYY-MM-DD');
        const targetJournalPath = journalPath ?? this.inferCurrentJournal()?.path ?? this.getDefaultReviewJournalPath();
        await this.setReviewState(targetJournalPath, resolvedAnchorDate, activeTab);

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
            reviewView.updateReviewState(targetJournalPath, resolvedAnchorDate, activeTab);
        }

        workspace.revealLeaf(leaf);
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
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        // Older installs stored a single journalTemplates map before engine-specific
        // settings existed. Preserve those choices by migrating them into the
        // templater map on load.
        this.settings.templaterJournalTemplates = this.settings.templaterJournalTemplates ?? this.settings.journalTemplates ?? {};
        this.settings.basesIntegrationEnabled = this.settings.basesIntegrationEnabled ?? false;
        this.settings.remindersEnabled = this.settings.remindersEnabled ?? false;
        this.settings.osNotificationsEnabled = this.settings.osNotificationsEnabled ?? false;
        this.settings.sidebarMode = this.settings.sidebarMode ?? 'journals-mini';
        this.settings.coreJournalTemplates = this.settings.coreJournalTemplates ?? {};
        this.settings.noteDateFormat = this.settings.noteDateFormat ?? 'YYYY-MM-DD';
        this.settings.noteDateFormatHistory = this.settings.noteDateFormatHistory ?? [];
        this.settings.journalCadences = this.settings.journalCadences ?? {};
        this.settings.customPromptLists = this.settings.customPromptLists ?? {};
        this.settings.journalPromptSettings = this.settings.journalPromptSettings ?? {};
        this.settings.journalPromptHistory = this.settings.journalPromptHistory ?? {};
        this.settings.journalReminderSettings = this.settings.journalReminderSettings ?? {};
        this.settings.reminderHistory = this.settings.reminderHistory ?? {};
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

    private getPromptSourceKey(promptSettings: JournalPromptSettings) {
        if (promptSettings.sourceType === 'file') {
            return `file:${promptSettings.selectedFilePath ?? ''}`;
        }

        return `${promptSettings.sourceType}:${promptSettings.selectedListId ?? ''}`;
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
