import {
    App,
    PluginSettingTab,
    TFile,
    TFolder,
    normalizePath,
} from 'obsidian';
import { createApp, markRaw, reactive, type App as VueApp } from 'vue';
import {
    JOURNALYST_BASE_MANAGED_PROPERTIES,
    getJournalystBaseFileName,
} from '../bases';
import type { JournalSettingsSection } from '../journalSettings';
import GlobalSettingsView from '../src/components/GlobalSettingsView.vue';
import type {
    JournalystSettingsActions,
    JournalystSettingsViewModel,
    JournalystSettingsViewState,
    PromptLibraryListItem,
    SettingsActionResult,
} from '../src/components/settings/types';
import JournalystPlugin from '../src/main';
import { previewJournalBasesBackfill } from './BasesModal';
import {
    confirmDeletePromptLibrary,
    openPromptLibraryModal,
    previewNoteMigration,
} from './SettingsModals';

export class JournalystSettingsTab extends PluginSettingTab {
    private vueApp: VueApp<Element> | null = null;
    private modelRequestRevision = 0;
    private mutationQueue: Promise<void> = Promise.resolve();
    private visible = false;
    private readonly state = reactive<JournalystSettingsViewState>({
        model: null,
        loading: true,
        error: '',
        revision: 0,
    });
    private readonly actions: JournalystSettingsActions;

    constructor(app: App, private readonly plugin: JournalystPlugin) {
        super(app, plugin);
        this.actions = this.createActions();
    }

    display(): void {
        this.visible = true;
        this.unmountVue();
        this.containerEl.empty();
        this.containerEl.addClass('journalyst-global-settings-tab');

        const mountTarget = this.containerEl.createDiv({ cls: 'journalyst-global-settings-mount' });
        this.vueApp = createApp(GlobalSettingsView, {
            state: this.state,
            actions: markRaw(this.actions),
        });
        this.vueApp.mount(mountTarget);
        void this.reloadModel();
    }

    hide(): void {
        this.visible = false;
        this.modelRequestRevision += 1;
        this.unmountVue();
        this.containerEl.removeClass('journalyst-global-settings-tab');
        this.containerEl.empty();
        super.hide();
    }

    onExternalSettingsChange() {
        void this.reloadModel();
    }

    private unmountVue() {
        this.vueApp?.unmount();
        this.vueApp = null;
    }

    private async reloadModel() {
        if (!this.visible) return;
        const requestRevision = ++this.modelRequestRevision;
        this.state.loading = !this.state.model;
        this.state.error = '';

        try {
            const model = await this.buildViewModel();
            if (requestRevision !== this.modelRequestRevision) return;
            this.state.model = model;
            this.state.revision += 1;
        } catch (error) {
            if (requestRevision !== this.modelRequestRevision) return;
            this.state.error = getErrorMessage(error, 'Journalyst could not load its settings.');
        } finally {
            if (requestRevision === this.modelRequestRevision) {
                this.state.loading = false;
            }
        }
    }

    private async buildViewModel(): Promise<JournalystSettingsViewModel> {
        this.plugin.refreshJournals();
        const templateEngine = this.plugin.settings.templateEngine;
        const folderPaths = Array.from(new Set([
            '/',
            ...this.app.vault.getAllLoadedFiles()
                .filter((file): file is TFolder => file instanceof TFolder)
                .map(folder => folder.path),
        ])).sort((left, right) => left === '/' ? -1 : right === '/' ? 1 : left.localeCompare(right));
        const configuredRoot = this.plugin.settings.rootDirectory;
        const folderOptions = folderPaths.map(path => ({
            path,
            label: path === '/' ? 'Vault root (/)' : path,
            missing: false,
        }));
        if (configuredRoot && !folderPaths.includes(configuredRoot)) {
            folderOptions.push({
                path: configuredRoot,
                label: `${configuredRoot} (missing)`,
                missing: true,
            });
        }

        const builtInLibraries = Object.values(this.plugin.getBuiltInPromptLists())
            .map(list => this.buildPromptLibraryItem(list.id, list.name, list.prompts.length, 'built-in'));
        const customLibraries = Object.values(this.plugin.getCustomPromptLists())
            .map(list => this.buildPromptLibraryItem(list.id, list.name, list.prompts.length, 'custom'));
        const basesResources = this.plugin.journals.flatMap(journal => (
            ['entries', 'reflections'] as const
        ).map(target => {
            const path = normalizePath(`${journal.path}/${getJournalystBaseFileName(target)}`);
            const resource = this.app.vault.getAbstractFileByPath(path);
            return resource instanceof TFile ? 'ready' : resource ? 'conflict' : 'missing';
        }));

        return {
            workspace: {
                rootDirectory: configuredRoot,
                folderOptions,
                sidebarMode: this.plugin.getSidebarMode(),
                journalCount: this.plugin.journals.length,
            },
            reminders: {
                enabled: this.plugin.areRemindersEnabled(),
                osNotificationsEnabled: this.plugin.areOsNotificationsEnabled(),
                permissionStatus: this.plugin.getNotificationPermissionStatus(),
                quietHours: this.plugin.getReminderQuietHours(),
            },
            notes: {
                dateFormat: this.plugin.settings.noteDateFormat,
            },
            prompts: {
                builtInLibraries,
                customLibraries,
            },
            templates: {
                engine: templateEngine,
                failureBehavior: this.plugin.settings.templateFailureBehavior,
                availability: templateEngine === 'none'
                    ? 'none'
                    : await this.plugin.getTemplateAvailability(templateEngine),
            },
            bases: {
                enabled: this.plugin.isBasesIntegrationEnabled(),
                corePluginAvailable: this.plugin.isBasesCorePluginAvailable(),
                readyResourceCount: basesResources.filter(status => status === 'ready').length,
                totalResourceCount: basesResources.length,
                conflictCount: basesResources.filter(status => status === 'conflict').length,
                managedProperties: JOURNALYST_BASE_MANAGED_PROPERTIES.map(property => ({ ...property })),
            },
        };
    }

    private buildPromptLibraryItem(
        id: string,
        name: string,
        promptCount: number,
        sourceType: 'built-in' | 'custom',
    ): PromptLibraryListItem {
        let journalUsageCount = 0;
        let weekdayOverrideCount = 0;

        this.plugin.journals.forEach(journal => {
            const settings = this.plugin.getJournalPromptSettings(journal.path);
            if (settings.sourceType === sourceType && settings.selectedListId === id) {
                journalUsageCount += 1;
            }
            weekdayOverrideCount += Object.values(settings.weekdaySourceOverrides)
                .filter(source => source.sourceType === sourceType && source.selectedListId === id).length;
        });

        return {
            id,
            name,
            promptCount,
            sourceType,
            journalUsageCount,
            weekdayOverrideCount,
        };
    }

    private createActions(): JournalystSettingsActions {
        return {
            reload: async () => this.reloadModel(),
            openJournalSettings: async (section = 'schedule') => this.openJournalSettings(section),
            updateRootDirectory: async path => {
                const result = await this.plugin.updateRootDirectory(path);
                await this.reloadModel();
                return result;
            },
            updateSidebarMode: async mode => this.runMutation(() => this.plugin.updateSidebarMode(mode)),
            updateRemindersEnabled: async enabled => this.runMutation(() => this.plugin.updateRemindersEnabled(enabled)),
            updateOsNotificationsEnabled: async enabled => this.runMutation(() => this.plugin.updateOsNotificationsEnabled(enabled)),
            requestNotificationPermission: async () => this.runMutation(() => this.plugin.requestNotificationPermission()),
            sendTestNotification: async () => this.runMutation(
                () => this.plugin.sendTestReminderNotification(),
                false,
            ),
            updateQuietHours: async settings => this.runMutation(() => this.plugin.updateReminderQuietHours(settings)),
            getNoteFileNameExample: format => this.plugin.formatJournalNoteFileNameForFormat(
                '2026-04-25',
                format.trim() || 'YYYY-MM-DD',
            ),
            saveNoteDateFormat: async format => this.runMutation(() => this.plugin.updateNoteDateFormat(format)),
            previewNoteMigration: async format => this.previewNoteMigration(format),
            editPromptLibrary: async listId => this.editPromptLibrary(listId),
            deletePromptLibrary: async listId => this.deletePromptLibrary(listId),
            updateTemplateEngine: async engine => this.runMutation(async () => {
                this.plugin.settings.templateEngine = engine;
                await this.plugin.saveSettings();
            }),
            updateTemplateFailureBehavior: async behavior => this.runMutation(async () => {
                this.plugin.settings.templateFailureBehavior = behavior;
                await this.plugin.saveSettings();
            }),
            updateBasesEnabled: async enabled => this.runMutation(() => this.plugin.updateBasesIntegrationEnabled(enabled)),
            createMissingBases: async () => {
                try {
                    const result = await this.plugin.generateBasesForAllJournals();
                    await this.reloadModel();
                    return result;
                } catch (error) {
                    return { ok: false, error: getErrorMessage(error, 'Journalyst could not create the missing Bases.') };
                }
            },
            previewBasesBackfill: async () => this.previewBasesBackfill(),
            openCorePluginsSettings: async () => this.plugin.openCorePluginsSettings(),
        };
    }

    private async runMutation(
        mutation: () => Promise<unknown>,
        reload = true,
    ): Promise<SettingsActionResult> {
        const operation = this.mutationQueue.then(() => this.performMutation(mutation, reload));
        this.mutationQueue = operation.then(() => undefined, () => undefined);
        return operation;
    }

    private async performMutation(
        mutation: () => Promise<unknown>,
        reload: boolean,
    ): Promise<SettingsActionResult> {
        const previousSettings = structuredClone(this.plugin.settings);
        try {
            await mutation();
            if (reload) await this.reloadModel();
            return { ok: true };
        } catch (error) {
            this.plugin.settings = previousSettings;
            try {
                await this.plugin.saveSettings();
            } catch (rollbackError) {
                console.error('Journalyst could not persist a settings rollback.', rollbackError);
            }
            if (reload) await this.reloadModel();
            return { ok: false, error: getErrorMessage(error, 'Journalyst could not save that setting.') };
        }
    }

    private async openJournalSettings(section: JournalSettingsSection) {
        const appWithSettings = this.app as typeof this.app & { setting?: { close(): void } };
        appWithSettings.setting?.close();
        await this.plugin.activateJournalSettings(undefined, section);
    }

    private async previewNoteMigration(format: string): Promise<SettingsActionResult> {
        try {
            const migrationItems = this.plugin.getJournalMigrationPlanForFormat(format);
            const shouldApply = await previewNoteMigration(this.app, format, migrationItems);
            if (shouldApply) {
                await this.plugin.applyJournalMigrationPlan(migrationItems);
                await this.reloadModel();
            }
            return { ok: true };
        } catch (error) {
            return { ok: false, error: getErrorMessage(error, 'Journalyst could not preview the filename migration.') };
        }
    }

    private async editPromptLibrary(listId?: string): Promise<SettingsActionResult> {
        const existing = listId ? this.plugin.getCustomPromptLists()[listId] : null;
        if (listId && !existing) {
            return { ok: false, error: 'Journalyst could not find that prompt library.' };
        }

        const draft = await openPromptLibraryModal(this.app, existing ? {
            name: existing.name,
            body: existing.prompts.join('\n'),
        } : null);
        if (!draft) return { ok: true };

        const targetId = listId ?? this.plugin.createCustomPromptListId();
        return this.runMutation(() => this.plugin.upsertCustomPromptList(targetId, draft.name, draft.body));
    }

    private async deletePromptLibrary(listId: string): Promise<SettingsActionResult> {
        const library = this.state.model?.prompts.customLibraries.find(item => item.id === listId);
        if (!library) {
            return { ok: false, error: 'Journalyst could not find that prompt library.' };
        }

        const confirmed = await confirmDeletePromptLibrary(this.app, library);
        if (!confirmed) return { ok: true };
        return this.runMutation(() => this.plugin.deleteCustomPromptList(listId));
    }

    private async previewBasesBackfill(): Promise<SettingsActionResult> {
        try {
            const items = await this.plugin.getJournalNotePropertyBackfillPreview();
            const shouldApply = await previewJournalBasesBackfill(this.app, items, 'all journals');
            if (shouldApply) {
                await this.plugin.applyJournalNotePropertyBackfill(items);
                await this.reloadModel();
            }
            return { ok: true };
        } catch (error) {
            return { ok: false, error: getErrorMessage(error, 'Journalyst could not preview the metadata changes.') };
        }
    }
}

function getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
}
