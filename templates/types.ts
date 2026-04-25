import type { TFile, TFolder } from 'obsidian';

export type TemplateEngine = 'none' | 'templater' | 'core';

export type TemplaterAvailability =
    | 'not-installed'
    | 'disabled'
    | 'no-template-folder'
    | 'ready';

export type TemplateAvailability = TemplaterAvailability;

export interface JournalTemplateEngineStrategy {
    getAvailability(): Promise<TemplateAvailability> | TemplateAvailability;
    getTemplateFolder(): Promise<string | null> | string | null;
    getTemplateFiles(): Promise<TFile[]> | TFile[];
    createJournalEntry(journalFolder: TFolder, templatePath: string, date: string): Promise<TFile | null>;
}

export interface TemplaterPlugin {
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

export interface ObsidianPlugins {
    enabledPlugins?: Set<string>;
    manifests?: Record<string, unknown>;
    plugins?: Record<string, unknown>;
}

export interface ObsidianInternalPlugins {
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

export interface CoreTemplatesSettings {
    folder?: string;
    templateFolder?: string;
    templates_folder?: string;
    dateFormat?: string;
    timeFormat?: string;
}
