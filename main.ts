import { Notice, Plugin, TAbstractFile, TFile, TFolder, normalizePath, WorkspaceLeaf, moment } from 'obsidian';
import { createTemplateStrategies } from "./templates/strategies";
import {
    CoreTemplatesSettings,
    JournalTemplateEngineStrategy,
    ObsidianInternalPlugins,
    ObsidianPlugins,
    TemplateAvailability,
    TemplateEngine,
    TemplateFailureBehavior,
    TemplaterPlugin,
} from "./templates/types";
import { SideBarView, VIEW_TYPE_SIDE_BAR } from "./views/SideBar";
import { JournalystSettingsTab } from "./views/Settings";

export interface JournalystPluginSettings {
    rootDirectory: string;
    templateEngine: TemplateEngine;
    templateFailureBehavior: TemplateFailureBehavior;
    templaterJournalTemplates: Record<string, string>;
    coreJournalTemplates: Record<string, string>;
    journalTemplates?: Record<string, string>;
}

const DEFAULT_SETTINGS: JournalystPluginSettings = {
	rootDirectory: '/',
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
            // Each engine owns its own application logic; the plugin only selects
            // the active engine and handles the fallback to default note content.
            const fileFromTemplate = await this.createJournalEntryFromTemplate(this.settings.templateEngine, journalFolder, templatePath, date);

            if (fileFromTemplate) {
                await this.app.workspace.openLinkText(fileFromTemplate.path, '/', false);
                return fileFromTemplate;
            }

            if (this.settings.templateFailureBehavior === 'abort') {
                new Notice('Journalyst did not create a note because the configured template could not be applied.');
                return null;
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
        this.templateStrategies = createTemplateStrategies({
            getCoreTemplatesSettings: () => this.getCoreTemplatesSettings(),
            getMarkdownFilesInFolder: (templateFolder) => this.getMarkdownFilesInFolder(templateFolder),
            getObsidianPlugins: () => this.getObsidianPlugins(),
            getRawCoreTemplateFolder: () => this.getRawCoreTemplateFolder(),
            getRawTemplaterTemplateFolder: () => this.getRawTemplaterTemplateFolder(),
            getTemplaterPlugin: () => this.getTemplaterPlugin(),
            isCoreTemplatesPluginEnabled: () => this.isCoreTemplatesPluginEnabled(),
            readTemplateFile: (templateFile) => this.app.vault.read(templateFile),
            renderCoreTemplate: (templateContents, date) => this.renderCoreTemplate(templateContents, date),
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
        // Older installs stored a single journalTemplates map before engine-specific
        // settings existed. Preserve those choices by migrating them into the
        // templater map on load.
        this.settings.templaterJournalTemplates = this.settings.templaterJournalTemplates ?? this.settings.journalTemplates ?? {};
        this.settings.coreJournalTemplates = this.settings.coreJournalTemplates ?? {};
        this.settings.templateEngine = this.settings.templateEngine ?? 'templater';
        this.settings.templateFailureBehavior = this.settings.templateFailureBehavior ?? 'fallback-default';
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
