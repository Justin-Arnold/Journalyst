export const JOURNALYST_ONBOARDING_VERSION = 1;
export const DEFAULT_ONBOARDING_ROOT = 'Journals';
export const DEFAULT_STARTER_JOURNALS = ['Personal', 'Work', 'Health'] as const;

export type JournalystOnboardingStatus = 'pending' | 'deferred' | 'completed';

export interface JournalystOnboardingSettings {
    version: typeof JOURNALYST_ONBOARDING_VERSION;
    status: JournalystOnboardingStatus;
}

export interface OnboardingFolderOption {
    path: string;
    name: string;
    journalCount: number;
}

export interface OnboardingViewModel {
    status: JournalystOnboardingStatus;
    configuredRootPath: string | null;
    suggestedRootPath: string;
    folderOptions: OnboardingFolderOption[];
}

export interface CompleteOnboardingRequest {
    rootPath: string;
    journalNames: string[];
}

export type CompleteOnboardingResult =
    | { ok: true }
    | { ok: false; error: string };

export function isCurrentOnboardingSettings(value: unknown): value is JournalystOnboardingSettings {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<JournalystOnboardingSettings>;
    const status = candidate.status;
    return candidate.version === JOURNALYST_ONBOARDING_VERSION
        && (status === 'pending' || status === 'deferred' || status === 'completed');
}

export function normalizeOnboardingSettings(value: unknown): JournalystOnboardingSettings {
    if (!isCurrentOnboardingSettings(value)) {
        return createPendingOnboardingSettings();
    }

    return {
        version: JOURNALYST_ONBOARDING_VERSION,
        status: value.status,
    };
}

export function createPendingOnboardingSettings(): JournalystOnboardingSettings {
    return {
        version: JOURNALYST_ONBOARDING_VERSION,
        status: 'pending',
    };
}
