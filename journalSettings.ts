import type { JournalCadenceConfig, JournalCadenceRevision, JournalSchedulePause } from './cadence';
import type { JournalPromptSettings, PromptOption } from './prompts';
import type { JournalReminderSettings } from './reminders';
import type { TemplateAvailability, TemplateEngine } from './templates/types';

export type JournalSettingsSection = 'schedule' | 'entry-setup' | 'reminders' | 'integrations';

export interface JournalSettingsOption {
    label: string;
    value: string;
}

export interface JournalSettingsSidebarItem {
    path: string;
    name: string;
    cadenceLabel: string;
    hasReminders: boolean;
}

export interface JournalSettingsViewModel {
    journalPath: string;
    journalName: string;
    entryCount: number;
    cadence: JournalCadenceConfig;
    cadenceHistory: JournalCadenceRevision[];
    schedulePauses: JournalSchedulePause[];
    reminderSettings: JournalReminderSettings;
    reminderSummary: string;
    remindersEnabled: boolean;
    promptSettings: JournalPromptSettings;
    promptStatus: string | null;
    promptListOptions: {
        builtIn: JournalSettingsOption[];
        custom: JournalSettingsOption[];
    };
    promptFileOptions: JournalSettingsOption[];
    promptOptions: PromptOption[];
    templateEngine: TemplateEngine;
    templateAvailability: TemplateAvailability | 'not-applicable';
    templatePath: string | null;
    templateStatus: string;
    templateOptions: JournalSettingsOption[];
    basesEnabled: boolean;
}

export interface JournalEntrySetupUpdate {
    templatePath: string | null;
    promptSettings: JournalPromptSettings;
}

export interface JournalSchedulePauseUpdate {
    id?: string;
    name: string;
    startDate: string;
    endDate: string;
}

export type JournalSchedulePauseActionResult = {
    ok: true;
    pauses: JournalSchedulePause[];
} | {
    ok: false;
    error: string;
};

export type JournalSettingsActionResult = {
    ok: true;
    journalPath?: string;
} | {
    ok: false;
    error: string;
};
