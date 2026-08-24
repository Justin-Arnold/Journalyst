import type { JournalCadenceConfig, JournalSchedulePause } from "../../../cadence";
import type { BasesGenerationTarget } from "../../../bases";
import type {
    JournalAutosaveResult,
    JournalAutosaveUndoResult,
    JournalBasesBackfillActionResult,
    JournalEntrySetupUpdate,
    JournalSettingsActionResult,
    JournalPromptPreviewModel,
    JournalSettingsSection,
    JournalSettingsViewModel,
    JournalSchedulePauseActionResult,
} from "../../../journalSettings";
import type {
    CompleteOnboardingRequest,
    CompleteOnboardingResult,
} from "../../../onboarding";
import type {
    JournalReminderSettings,
    ReminderQuietHoursSettings,
} from "../../../reminders";
import type { JournalPromptSettings, PromptOption } from "../../../prompts";
import type {
    LookbackResult,
    ReviewLookbackPreview,
    ReviewWorkspaceTab,
    SynthesisPreviewRequest,
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
    loadReviewLookbackPreviews(lookbacks: LookbackResult[]): Promise<ReviewLookbackPreview[]>;
    loadJournalPromptOptions(settings: JournalPromptSettings): Promise<PromptOption[]>;
    loadJournalPromptPreview(settings: JournalPromptSettings): Promise<JournalPromptPreviewModel | null>;
    saveJournalCadence(journalPath: string, cadence: JournalCadenceConfig): Promise<JournalAutosaveResult<JournalCadenceConfig>>;
    editJournalSchedulePause(journalPath: string, pause: JournalSchedulePause | null): Promise<JournalSchedulePauseActionResult | null>;
    removeJournalSchedulePause(journalPath: string, pause: JournalSchedulePause): Promise<JournalSchedulePauseActionResult | null>;
    saveJournalEntrySetup(journalPath: string, update: JournalEntrySetupUpdate): Promise<JournalAutosaveResult<JournalEntrySetupUpdate>>;
    saveJournalReminderSettings(journalPath: string, settings: JournalReminderSettings): Promise<JournalAutosaveResult<JournalReminderSettings>>;
    undoJournalSettingsChange(undoToken: string): Promise<JournalAutosaveUndoResult>;
    renameJournal(journalPath: string, name: string): Promise<JournalSettingsActionResult>;
    ensureJournalBase(journalPath: string, target: BasesGenerationTarget): Promise<JournalSettingsActionResult>;
    resetJournalBase(journalPath: string, target: BasesGenerationTarget): Promise<JournalSettingsActionResult | null>;
    previewJournalBasesBackfill(journalPath: string): Promise<JournalBasesBackfillActionResult>;
    openJournalBase(filePath: string): Promise<void>;
    openCorePluginsSettings(): Promise<void>;
    confirmDiscardJournalAutosave(): Promise<boolean>;
    createEntry(): Promise<void>;
    createJournal(): Promise<void>;
    createJournalEntry(journalPath: string, date?: string): Promise<void>;
    openSettings(): Promise<void>;
    openNote(filePath: string): Promise<void>;
    createSynthesisNote(journalPath: string, anchorDate: string, periodType: SynthesisPeriodType): Promise<void>;
    previewSynthesisNote(request: SynthesisPreviewRequest): Promise<void>;
}

export interface ReminderJournalModel {
    journalPath: string;
    journalName: string;
    cadenceLabel: string;
    status: 'active' | 'global-off' | 'off';
    enabledRuleCount: number;
    rules: ReminderRuleSummaryModel[];
}

export interface ReminderRuleSummaryModel {
    id: 'entry' | 'weekly' | 'monthly' | 'quarterly';
    label: string;
    enabled: boolean;
    available: boolean;
    scheduleLabel: string;
    deliveryLabel: string;
}

export interface ReminderWorkspaceModel {
    remindersEnabled: boolean;
    osNotificationsEnabled: boolean;
    quietHours: ReminderQuietHoursSettings;
    permissionStatus: NotificationPermission | 'unsupported';
    activeJournalCount: number;
    configuredJournalCount: number;
    enabledRuleCount: number;
    osPreferredRuleCount: number;
    journals: ReminderJournalModel[];
}
