import type { JournalCadenceType } from "../../../cadence";
import type {
    CompleteOnboardingRequest,
    CompleteOnboardingResult,
} from "../../../onboarding";
import type { JournalReminderSettings } from "../../../reminders";
import type {
    ReviewWorkspaceTab,
    SynthesisNotePreview,
    SynthesisPeriodType,
} from "../../../review/types";

export interface ReviewViewState {
    journalPath: string | null;
    anchorDate: string;
    activeTab: ReviewWorkspaceTab;
    revision: number;
}

export interface MainViewActions {
    completeOnboarding(request: CompleteOnboardingRequest): Promise<CompleteOnboardingResult>;
    deferOnboarding(): Promise<void>;
    resumeOnboarding(): Promise<void>;
    setReviewState(journalPath: string | null, anchorDate: string, activeTab: ReviewWorkspaceTab): Promise<void>;
    activateJournalTab(journalPath: string, activeTab: ReviewWorkspaceTab): Promise<void>;
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
    updateJournalReminderSettings(journalPath: string, settings: JournalReminderSettings): Promise<void>;
}

export interface ReminderJournalModel {
    journalPath: string;
    journalName: string;
    cadenceType: JournalCadenceType;
    cadenceLabel: string;
    reminderSummary: string;
    settings: JournalReminderSettings;
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
