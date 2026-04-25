import { Notice, TAbstractFile, TFile, TFolder, normalizePath } from 'obsidian';
import {
    CoreTemplatesSettings,
    JournalTemplateEngineStrategy,
    ObsidianPlugins,
} from './types';

interface TemplateStrategyContext {
    getCoreTemplatesSettings: () => Promise<CoreTemplatesSettings | null>;
    getMarkdownFilesInFolder: (templateFolder: string) => TFile[];
    getObsidianPlugins: () => ObsidianPlugins | undefined;
    getRawCoreTemplateFolder: () => Promise<string | null>;
    getRawTemplaterTemplateFolder: () => string | null;
    getTemplaterPlugin: () => import('./types').TemplaterPlugin | undefined;
    isCoreTemplatesPluginEnabled: () => boolean;
    readTemplateFile: (templateFile: TFile) => Promise<string>;
    renderCoreTemplate: (templateContents: string, date: string) => Promise<string>;
    vaultCreate: (path: string, contents: string) => Promise<TFile>;
    vaultGetAbstractFileByPath: (path: string) => TAbstractFile | null;
}

export function createTemplateStrategies(context: TemplateStrategyContext): {
    templater: JournalTemplateEngineStrategy;
    core: JournalTemplateEngineStrategy;
} {
    return {
        templater: {
            getAvailability: () => {
                const plugins = context.getObsidianPlugins();

                if (!plugins?.manifests?.['templater-obsidian']) {
                    return 'not-installed';
                }

                if (!plugins.enabledPlugins?.has('templater-obsidian') || !plugins.plugins?.['templater-obsidian']) {
                    return 'disabled';
                }

                if (!context.getRawTemplaterTemplateFolder()) {
                    return 'no-template-folder';
                }

                return 'ready';
            },
            getTemplateFolder: () => context.getRawTemplaterTemplateFolder(),
            getTemplateFiles: () => {
                const templateFolder = context.getRawTemplaterTemplateFolder();

                if (!templateFolder) {
                    return [];
                }

                return context.getMarkdownFilesInFolder(templateFolder);
            },
            createJournalEntry: async (journalFolder, templatePath, date) => {
                const templateFile = context.vaultGetAbstractFileByPath(templatePath);

                if (!(templateFile instanceof TFile)) {
                    new Notice(`Journalyst could not find template "${templatePath}". Created a default journal entry instead.`);
                    return null;
                }

                const templater = context.getTemplaterPlugin();

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
                if (!context.isCoreTemplatesPluginEnabled()) {
                    return 'disabled';
                }

                if (!await context.getRawCoreTemplateFolder()) {
                    return 'no-template-folder';
                }

                return 'ready';
            },
            getTemplateFolder: () => context.getRawCoreTemplateFolder(),
            getTemplateFiles: async () => {
                const templateFolder = await context.getRawCoreTemplateFolder();

                if (!templateFolder) {
                    return [];
                }

                return context.getMarkdownFilesInFolder(templateFolder);
            },
            createJournalEntry: async (journalFolder, templatePath, date) => {
                const templateFile = context.vaultGetAbstractFileByPath(templatePath);

                if (!(templateFile instanceof TFile)) {
                    new Notice(`Journalyst could not find template "${templatePath}". Created a default journal entry instead.`);
                    return null;
                }

                if (!context.isCoreTemplatesPluginEnabled() || !await context.getRawCoreTemplateFolder()) {
                    new Notice('Journalyst could not use the core Templates plugin. Created a default journal entry instead.');
                    return null;
                }

                try {
                    const templateContents = await context.readTemplateFile(templateFile);
                    const renderedContents = await context.renderCoreTemplate(templateContents, date);
                    const fullPath = normalizePath(journalFolder.path + '/' + date + '.md');
                    return await context.vaultCreate(fullPath, renderedContents);
                } catch (error) {
                    console.error('Journalyst failed to create a journal entry from the core Templates plugin.', error);
                    new Notice('Journalyst could not apply the configured core template. Created a default journal entry instead.');
                    return null;
                }
            }
        }
    };
}
