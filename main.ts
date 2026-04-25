import { Notice, Plugin, TFile, TFolder, normalizePath, WorkspaceLeaf, moment } from 'obsidian';
import { SideBarView, VIEW_TYPE_SIDE_BAR } from "./views/SideBar";
import { JournalystSettingsTab } from "./views/Settings";

export type TemplateEngine = 'none' | 'templater' | 'core';

export interface JournalystPluginSettings {
    rootDirectory: string;
    templateEngine: TemplateEngine;
    templaterJournalTemplates: Record<string, string>;
    coreJournalTemplates: Record<string, string>;
    journalTemplates?: Record<string, string>;
}

const DEFAULT_SETTINGS: JournalystPluginSettings = {
	rootDirectory: '/',
    templateEngine: 'templater',
    templaterJournalTemplates: {},
    coreJournalTemplates: {},
}

interface TemplaterPlugin {
    settings?: {
        templates_folder?: string;
    };
    templater?: {
        create_new_note_from_template: (
            template: TFile,
            folder?: TFolder | string,
            filename?: string,
            openNewNote?: boolean,
        ) => Promise<TFile | undefined>;
    };
}

interface ObsidianPlugins {
    enabledPlugins?: Set<string>;
    manifests?: Record<string, unknown>;
    plugins?: Record<string, unknown>;
}

interface ObsidianInternalPlugins {
    getPluginById?: (pluginId: string) => {
        enabled?: boolean;
        _loaded?: boolean;
        instance?: unknown;
    } | null;
    plugins?: Record<string, {
        enabled?: boolean;
        _loaded?: boolean;
        instance?: unknown;
    }>;
}

export type TemplaterAvailability =
    | 'not-installed'
    | 'disabled'
    | 'no-template-folder'
    | 'ready';

export type TemplateAvailability = TemplaterAvailability;

interface CoreTemplatesSettings {
    folder?: string;
    templateFolder?: string;
    templates_folder?: string;
    dateFormat?: string;
    timeFormat?: string;
}

interface JournalTemplateEngineStrategy {
    getAvailability(): Promise<TemplateAvailability> | TemplateAvailability;
    getTemplateFolder(): Promise<string | null> | string | null;
    getTemplateFiles(): Promise<TFile[]> | TFile[];
    createJournalEntry(journalFolder: TFolder, templatePath: string, date: string): Promise<TFile | null>;
}

export default class JournalystPlugin extends Plugin {
	settings: JournalystPluginSettings;
    journals: TFolder[] = [];
    private journalCommandIds: string[] = [];
    private templateStrategies: Partial<Record<Exclude<TemplateEngine, 'none'>, JournalTemplateEngineStrategy>>;

	async onload() {
		await this.loadSettings();
        this.initializeTemplateStrategies();
        this.addSettingTab(new JournalystSettingsTab(this.app, this));

		this.addRibbonIcon('book-copy', 'Go to Journalyst view', () => {
            this.activateView();
        });

        this.app.workspace.onLayoutReady(() => {
            this.refreshJournals();

            this.registerView(
                VIEW_TYPE_SIDE_BAR,
                (leaf) => new SideBarView(leaf, this)
            );
        })

        this.registerEvent(
            this.app.vault.on('create', (item) => this.onItemChange())
        );
        this.registerEvent(
            this.app.vault.on('delete', (item) => this.onItemChange())
        );
        this.registerEvent(
            this.app.vault.on('rename', (item) => this.onItemChange())
        );
    };

	onunload() {}

    private onItemChange() {
        this.refreshJournals();
    }

    refreshJournals() {
        const rootFolder = this.app.vault.getAbstractFileByPath(this.settings.rootDirectory);

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
        const newFileName = date + '.md';
        const fullPath = normalizePath(journalFolder.path + '/' + newFileName);
        const existingFile = this.app.vault.getAbstractFileByPath(fullPath);

        if (existingFile instanceof TFile) {
            await this.app.workspace.openLinkText(existingFile.path, '/', false);
            return existingFile;
        }

        const templatePath = this.getJournalTemplatePath(this.settings.templateEngine, journalFolder.path);
        if (templatePath) {
            const fileFromTemplate = await this.createJournalEntryFromTemplate(this.settings.templateEngine, journalFolder, templatePath, date);

            if (fileFromTemplate) {
                await this.app.workspace.openLinkText(fileFromTemplate.path, '/', false);
                return fileFromTemplate;
            }
        }

        const file = await this.app.vault.create(fullPath, this.getDefaultJournalEntryContents(date));
        await this.app.workspace.openLinkText(file.path, '/', false);
        return file;
    }

    private async createJournalEntryFromTemplate(templateEngine: TemplateEngine, journalFolder: TFolder, templatePath: string, date: string) {
        const templateStrategy = this.getTemplateStrategy(templateEngine);

        if (!templateStrategy) {
            return null;
        }

        return templateStrategy.createJournalEntry(journalFolder, templatePath, date);
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

    private initializeTemplateStrategies() {
        this.templateStrategies = {
            templater: {
                getAvailability: () => {
                    const plugins = this.getObsidianPlugins();

                    if (!plugins?.manifests?.['templater-obsidian']) {
                        return 'not-installed';
                    }

                    if (!plugins.enabledPlugins?.has('templater-obsidian') || !plugins.plugins?.['templater-obsidian']) {
                        return 'disabled';
                    }

                    if (!this.getRawTemplaterTemplateFolder()) {
                        return 'no-template-folder';
                    }

                    return 'ready';
                },
                getTemplateFolder: () => this.getRawTemplaterTemplateFolder(),
                getTemplateFiles: () => {
                    const templateFolder = this.getRawTemplaterTemplateFolder();

                    if (!templateFolder) {
                        return [];
                    }

                    return this.getMarkdownFilesInFolder(templateFolder);
                },
                createJournalEntry: async (journalFolder, templatePath, date) => {
                    const templateFile = this.app.vault.getAbstractFileByPath(templatePath);

                    if (!(templateFile instanceof TFile)) {
                        new Notice(`Journalyst could not find template "${templatePath}". Created a default journal entry instead.`);
                        return null;
                    }

                    const templater = this.getTemplaterPlugin();

                    if (!templater?.templater?.create_new_note_from_template) {
                        new Notice('Journalyst could not find Templater. Created a default journal entry instead.');
                        return null;
                    }

                    try {
                        const file = await templater.templater.create_new_note_from_template(templateFile, journalFolder, date, false);
                        return file ?? null;
                    } catch (error) {
                        console.error('Journalyst failed to create a journal entry from Templater.', error);
                        new Notice('Journalyst could not apply the configured template. Created a default journal entry instead.');
                        return null;
                    }
                }
            },
            core: {
                getAvailability: async () => {
                    if (!this.isCoreTemplatesPluginEnabled()) {
                        return 'disabled';
                    }

                    if (!await this.getRawCoreTemplateFolder()) {
                        return 'no-template-folder';
                    }

                    return 'ready';
                },
                getTemplateFolder: () => this.getRawCoreTemplateFolder(),
                getTemplateFiles: async () => {
                    const templateFolder = await this.getRawCoreTemplateFolder();

                    if (!templateFolder) {
                        return [];
                    }

                    return this.getMarkdownFilesInFolder(templateFolder);
                },
                createJournalEntry: async (journalFolder, templatePath, date) => {
                    const templateFile = this.app.vault.getAbstractFileByPath(templatePath);

                    if (!(templateFile instanceof TFile)) {
                        new Notice(`Journalyst could not find template "${templatePath}". Created a default journal entry instead.`);
                        return null;
                    }

                    const availability = await this.getTemplateStrategy('core')?.getAvailability();
                    if (availability !== 'ready') {
                        new Notice('Journalyst could not use the core Templates plugin. Created a default journal entry instead.');
                        return null;
                    }

                    try {
                        const templateContents = await this.app.vault.read(templateFile);
                        const renderedContents = await this.renderCoreTemplate(templateContents, date);
                        const fullPath = normalizePath(journalFolder.path + '/' + date + '.md');
                        return await this.app.vault.create(fullPath, renderedContents);
                    } catch (error) {
                        console.error('Journalyst failed to create a journal entry from the core Templates plugin.', error);
                        new Notice('Journalyst could not apply the configured core template. Created a default journal entry instead.');
                        return null;
                    }
                }
            }
        };
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

    private async renderCoreTemplate(templateContents: string, date: string) {
        const coreTemplateSettings = await this.getCoreTemplatesSettings();
        const defaultDateFormat = coreTemplateSettings?.dateFormat || 'YYYY-MM-DD';
        const defaultTimeFormat = coreTemplateSettings?.timeFormat || 'HH:mm';

        return templateContents.replace(/{{\s*(title|date|time)(?::([^}]+))?\s*}}/g, (_match, variable: string, explicitFormat?: string) => {
            if (variable === 'title') {
                return date;
            }

            const format = explicitFormat?.trim() || (variable === 'date' ? defaultDateFormat : defaultTimeFormat);
            return moment().format(format);
        });
    }

    private getMarkdownFilesInFolder(templateFolder: string) {
        const normalizedTemplateFolder = normalizePath(templateFolder);
        const templateFolderPrefix = normalizedTemplateFolder === '/' ? '' : normalizedTemplateFolder + '/';

        return this.app.vault.getMarkdownFiles()
            .filter(file => file.path.startsWith(templateFolderPrefix));
    }

    async activateView() {
        const { workspace } = this.app;

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

        // "Reveal" the leaf in case it is in a collapsed sidebar
        workspace.revealLeaf(leaf);
    }


	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        this.settings.templaterJournalTemplates = this.settings.templaterJournalTemplates ?? this.settings.journalTemplates ?? {};
        this.settings.coreJournalTemplates = this.settings.coreJournalTemplates ?? {};
        this.settings.templateEngine = this.settings.templateEngine ?? 'templater';
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
