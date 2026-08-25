import type { JournalSettingsSection } from '../../../journalSettings';
import type { ReminderQuietHoursSettings } from '../../../reminders';
import type { SidebarMode } from '../../../review/types';
import type {
    TemplateAvailability,
    TemplateEngine,
    TemplateFailureBehavior,
} from '../../../templates/types';

export type SettingsStatusTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error';

export interface SettingsActionResult {
    ok: boolean;
    error?: string;
}

export interface SettingsFolderOption {
    path: string;
    label: string;
    missing: boolean;
}

export interface WorkspaceSettingsModel {
    rootDirectory: string | null;
    folderOptions: SettingsFolderOption[];
    sidebarMode: SidebarMode;
    journalCount: number;
}

export interface ReminderSettingsModel {
    enabled: boolean;
    osNotificationsEnabled: boolean;
    permissionStatus: NotificationPermission | 'unsupported';
    quietHours: ReminderQuietHoursSettings;
}

export interface NoteFileSettingsModel {
    dateFormat: string;
}

export interface PromptLibraryListItem {
    id: string;
    name: string;
    promptCount: number;
    sourceType: 'built-in' | 'custom';
    journalUsageCount: number;
    weekdayOverrideCount: number;
}

export interface PromptSettingsModel {
    builtInLibraries: PromptLibraryListItem[];
    customLibraries: PromptLibraryListItem[];
}

export interface TemplateSettingsModel {
    engine: TemplateEngine;
    failureBehavior: TemplateFailureBehavior;
    availability: TemplateAvailability | 'none';
}

export interface BasesSettingsModel {
    enabled: boolean;
    corePluginAvailable: boolean;
    readyResourceCount: number;
    totalResourceCount: number;
    conflictCount: number;
    managedProperties: Array<{ key: string; label: string }>;
}

export interface JournalystSettingsViewModel {
    workspace: WorkspaceSettingsModel;
    reminders: ReminderSettingsModel;
    notes: NoteFileSettingsModel;
    prompts: PromptSettingsModel;
    templates: TemplateSettingsModel;
    bases: BasesSettingsModel;
}

export interface JournalystSettingsViewState {
    model: JournalystSettingsViewModel | null;
    loading: boolean;
    error: string;
    revision: number;
}

export interface JournalystSettingsActions {
    reload(): Promise<void>;
    openJournalSettings(section?: JournalSettingsSection): Promise<void>;
    updateRootDirectory(path: string | null): Promise<SettingsActionResult>;
    updateSidebarMode(mode: SidebarMode): Promise<SettingsActionResult>;
    updateRemindersEnabled(enabled: boolean): Promise<SettingsActionResult>;
    updateOsNotificationsEnabled(enabled: boolean): Promise<SettingsActionResult>;
    requestNotificationPermission(): Promise<SettingsActionResult>;
    sendTestNotification(): Promise<SettingsActionResult>;
    updateQuietHours(settings: ReminderQuietHoursSettings): Promise<SettingsActionResult>;
    getNoteFileNameExample(format: string): string;
    saveNoteDateFormat(format: string): Promise<SettingsActionResult>;
    previewNoteMigration(format: string): Promise<SettingsActionResult>;
    editPromptLibrary(listId?: string): Promise<SettingsActionResult>;
    deletePromptLibrary(listId: string): Promise<SettingsActionResult>;
    updateTemplateEngine(engine: TemplateEngine): Promise<SettingsActionResult>;
    updateTemplateFailureBehavior(behavior: TemplateFailureBehavior): Promise<SettingsActionResult>;
    updateBasesEnabled(enabled: boolean): Promise<SettingsActionResult>;
    createMissingBases(): Promise<SettingsActionResult>;
    previewBasesBackfill(): Promise<SettingsActionResult>;
    openCorePluginsSettings(): Promise<void>;
}
