import type { JournalCadenceConfig, JournalCadenceType, JournalSchedulePause } from "../../../cadence";
import type {
    JournalEntrySetupUpdate,
    JournalSettingsActionResult,
    JournalSettingsSection,
    JournalSettingsViewModel,
    JournalSchedulePauseActionResult,
} from "../../../journalSettings";
import type {
    CompleteOnboardingRequest,
    CompleteOnboardingResult,
} from "../../../onboarding";
import type { JournalReminderSettings } from "../../../reminders";
import type { JournalPromptSettings, PromptOption } from "../../../prompts";
import type {
    ReviewWorkspaceTab,
    SynthesisNotePreview,
    SynthesisPeriodType,
} from "../../../review/types";

export interface ReviewViewState {
    journalPath: string | null;
    anchorDate: string;
    activeTab: ReviewWorkspaceTab;
    journalSettingsSection: JournalSettingsSection;
    revision: number;
}

export interface MainViewActions {
    completeOnboarding(request: CompleteOnboardingRequest): Promise<CompleteOnboardingResult>;
    deferOnboarding(): Promise<void>;
    resumeOnboarding(): Promise<void>;
    setReviewState(journalPath: string | null, anchorDate: string, activeTab: ReviewWorkspaceTab): Promise<void>;
    activateJournalTab(journalPath: string, activeTab: ReviewWorkspaceTab): Promise<void>;
    activateJournalSettings(journalPath: string, section?: JournalSettingsSection): Promise<void>;
    loadJournalSettings(journalPath: string): Promise<JournalSettingsViewModel | null>;
    loadJournalPromptOptions(settings: JournalPromptSettings): Promise<PromptOption[]>;
    saveJournalCadence(journalPath: string, cadence: JournalCadenceConfig): Promise<JournalSettingsActionResult>;
    editJournalSchedulePause(journalPath: string, pause: JournalSchedulePause | null): Promise<JournalSchedulePauseActionResult | null>;
    removeJournalSchedulePause(journalPath: string, pause: JournalSchedulePause): Promise<JournalSchedulePauseActionResult | null>;
    saveJournalEntrySetup(journalPath: string, update: JournalEntrySetupUpdate): Promise<JournalSettingsActionResult>;
    saveJournalReminderSettings(journalPath: string, settings: JournalReminderSettings): Promise<JournalSettingsActionResult>;
    renameJournal(journalPath: string, name: string): Promise<JournalSettingsActionResult>;
    generateBasesForJournal(journalPath: string): Promise<JournalSettingsActionResult>;
    confirmDiscardJournalChanges(): Promise<boolean>;
    createEntry(): Promise<void>;
    createJournal(): Promise<void>;
    createJournalEntry(journalPath: string, date?: string): Promise<void>;
    openSettings(): Promise<void>;
    openNote(filePath: string): Promise<void>;
    createSynthesisNote(journalPath: string, anchorDate: string, periodType: SynthesisPeriodType): Promise<void>;
    updateRemindersEnabled(enabled: boolean): Promise<void>;
    updateOsNotificationsEnabled(enabled: boolean): Promise<void>;
    requestNotificationPermission(): Promise<void>;
    sendTestReminderNotification(): Promise<void>;
}

export interface ReminderJournalModel {
    journalPath: string;
    journalName: string;
    cadenceType: JournalCadenceType;
    cadenceLabel: string;
    reminderSummary: string;
    entryReminderEnabled: boolean;
    reviewReminderCount: number;
}

export interface ReminderWorkspaceModel {
    remindersEnabled: boolean;
    osNotificationsEnabled: boolean;
    permissionStatus: NotificationPermission | 'unsupported';
    activeJournalCount: number;
    journals: ReminderJournalModel[];
}

export interface SynthesisPreviewModel {
    preview: SynthesisNotePreview;
    exists: boolean;
}
