<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { normalizePath } from "obsidian";
import moment from "moment";
import { getCadenceLabel, getCompactCadenceLabel } from "../../cadence";
import type { CompleteOnboardingRequest } from "../../onboarding";
import {
    buildJournalHomeAttentionItems,
    buildJournalHomeSummary,
    buildJournalOverviewData,
    type JournalHomeAttentionTarget,
} from "../../review/buildHomeSnapshot";
import {
    buildJournalAnalyticsSnapshot,
    buildJournalReviewSnapshot,
    buildSynthesisNotePreview,
    type SnapshotBuildOptions,
} from "../../review/buildSnapshot";
import type {
    ReviewLookbackPreview,
    ReviewWorkspaceTab,
    SynthesisPeriodType,
} from "../../review/types";
import { hasAnyEnabledReminder } from "../../reminders";
import type JournalystPlugin from "../main";
import MainViewContextControls from "./MainViewContextControls.vue";
import MainViewHeader from "./MainViewHeader.vue";
import ObsidianIcon from "./ObsidianIcon.vue";
import AnalyticsTab from "./main-view/AnalyticsTab.vue";
import HomeTab from "./main-view/HomeTab.vue";
import JournalsTab from "./main-view/JournalsTab.vue";
import OnboardingView from "./main-view/OnboardingView.vue";
import RemindersTab from "./main-view/RemindersTab.vue";
import ReviewTab from "./main-view/ReviewTab.vue";
import SynthesisTab from "./main-view/SynthesisTab.vue";
import type {
    MainViewActions,
    ReminderWorkspaceModel,
    ReviewViewState,
    SynthesisPreviewModel,
} from "./main-view/types";
import type { JournalSettingsSidebarItem, JournalSettingsViewModel } from "../../journalSettings";

const props = defineProps<{
    plugin: JournalystPlugin;
    state: ReviewViewState;
    actions: MainViewActions;
}>();

const onboardingBusy = ref(false);
const onboardingError = ref('');
const synthesisAttentionPeriod = ref<SynthesisPeriodType | null>(null);
const journalEditorHasLocalChanges = ref(false);
const journalsTab = ref<InstanceType<typeof JournalsTab> | null>(null);
const journalSettingsModel = ref<JournalSettingsViewModel | null>(null);
const journalSettingsLoading = ref(false);
const journalSettingsError = ref('');
const reviewLookbackPreviews = ref<ReviewLookbackPreview[]>([]);
const reviewLookbacksLoading = ref(false);
let journalSettingsRequestRevision = 0;
let reviewLookbackRequestRevision = 0;
const snapshotBuildOptions: SnapshotBuildOptions = {
    isEntryComplete: file => props.plugin.isJournalEntryComplete(file),
};

const tabs: Array<{ id: ReviewWorkspaceTab; label: string; icon: string }> = [
    { id: 'home', label: 'Home', icon: 'house' },
    { id: 'review', label: 'Review', icon: 'history' },
    { id: 'analytics', label: 'Analytics', icon: 'chart-column' },
    { id: 'synthesis', label: 'Synthesis', icon: 'file-pen-line' },
    { id: 'reminders', label: 'Reminders', icon: 'bell' },
    { id: 'journals', label: 'Journals', icon: 'notebook-pen' },
];

const workspaceContext = computed(() => ({
    revision: props.state.revision,
    journalFolders: props.plugin.journals,
    selectedJournal: props.state.journalPath
        ? props.plugin.getJournalByPath(props.state.journalPath)
        : null,
}));

const journals = computed(() => workspaceContext.value.journalFolders
    .map(journal => ({ path: journal.path, name: journal.name })));

const journalOverviews = computed(() => workspaceContext.value.journalFolders
    .map(journal => buildJournalOverviewData(props.plugin, journal)));

const journalSidebarItems = computed<JournalSettingsSidebarItem[]>(() => workspaceContext.value.journalFolders
    .map(journal => {
        const journalPath = journal.path;
        const cadenceTimeline = props.plugin.getJournalCadenceTimeline(journalPath);

        return {
            path: journalPath,
            name: journal.name,
            cadenceLabel: getCompactCadenceLabel(props.plugin.getJournalCadence(journalPath)),
            hasReminders: hasAnyEnabledReminder(
                props.plugin.getJournalReminderSettings(journalPath),
                cadenceTimeline,
            ),
        };
    }));

const selectedJournal = computed(() => workspaceContext.value.selectedJournal);
const selectedJournalRequired = computed(() => (
    ['review', 'analytics', 'synthesis'] as ReviewWorkspaceTab[]
).includes(props.state.activeTab));

const onboardingModel = computed(() => {
    void workspaceContext.value.revision;
    return props.plugin.getOnboardingViewModel();
});

const activeTab = computed<ReviewWorkspaceTab>({
    get: () => props.state.activeTab,
    set: (value) => {
        void changeWorkspaceTab(value);
    },
});

async function changeWorkspaceTab(value: ReviewWorkspaceTab) {
    if (value === props.state.activeTab) return;
    if (props.state.activeTab === 'journals') {
        const canLeave = await journalsTab.value?.prepareToLeave();
        if (canLeave === false) return;
        journalEditorHasLocalChanges.value = false;
    }

    synthesisAttentionPeriod.value = null;
    await props.actions.setReviewState(props.state.journalPath, props.state.anchorDate, value);
}

const journalPath = computed<string>({
    get: () => props.state.journalPath ?? '',
    set: (value) => {
        synthesisAttentionPeriod.value = null;
        void props.actions.setReviewState(value || null, props.state.anchorDate, props.state.activeTab);
    },
});

const anchorDate = computed<string>({
    get: () => props.state.anchorDate,
    set: (value) => {
        synthesisAttentionPeriod.value = null;
        void props.actions.setReviewState(
            props.state.journalPath,
            value || moment().format('YYYY-MM-DD'),
            props.state.activeTab,
        );
    },
});

const homeWorkspace = computed(() => {
    const overviews = journalOverviews.value;
    const summary = buildJournalHomeSummary(props.plugin, overviews);

    return {
        revision: workspaceContext.value.revision,
        summary,
        attentionItems: buildJournalHomeAttentionItems(props.plugin, overviews, { summary }),
        journals: overviews,
    };
});

const homeSummary = computed(() => homeWorkspace.value.summary);
const homeAttentionItems = computed(() => homeWorkspace.value.attentionItems);
const homeJournals = computed(() => homeWorkspace.value.journals);

function activateHomeAttention(target: JournalHomeAttentionTarget) {
    if (target.type === 'entry') {
        void props.actions.createJournalEntry(target.journalPath, target.date);
        return;
    }

    synthesisAttentionPeriod.value = target.type === 'synthesis' ? target.periodType : null;
    void props.actions.setReviewState(target.journalPath, target.anchorDate, target.type);
}

const reviewSnapshot = computed(() => {
    const journal = workspaceContext.value.selectedJournal;
    return journal
        ? buildJournalReviewSnapshot(
            journal,
            props.state.anchorDate,
            props.plugin.settings,
            {
                ...snapshotBuildOptions,
                promptSourceLabel: getReviewPromptSourceLabel(journal.path),
                templateLabel: getReviewTemplateLabel(journal.path),
            },
        )
        : null;
});

function getReviewPromptSourceLabel(journalPath: string) {
    const settings = props.plugin.getJournalPromptSettings(journalPath);
    if (!settings.enabled) return 'Off';

    if (settings.sourceType === 'file') {
        return getPathLabel(settings.selectedFilePath) || 'Missing note';
    }

    const lists = settings.sourceType === 'built-in'
        ? Object.values(props.plugin.getBuiltInPromptLists())
        : Object.values(props.plugin.getCustomPromptLists());
    return lists.find(list => list.id === settings.selectedListId)?.name ?? 'Missing library';
}

function getReviewTemplateLabel(journalPath: string) {
    const templatePath = props.plugin.getJournalTemplatePath(props.plugin.settings.templateEngine, journalPath);
    return templatePath ? getPathLabel(templatePath) : 'Journalyst default';
}

function getPathLabel(path?: string) {
    return path?.split('/').pop()?.replace(/\.md$/i, '') ?? '';
}

async function loadReviewLookbacks() {
    const requestRevision = ++reviewLookbackRequestRevision;
    const snapshot = reviewSnapshot.value;

    if (props.state.activeTab !== 'review' || !snapshot) {
        reviewLookbackPreviews.value = [];
        reviewLookbacksLoading.value = false;
        return;
    }

    reviewLookbackPreviews.value = [];
    reviewLookbacksLoading.value = true;
    try {
        const previews = await props.actions.loadReviewLookbackPreviews(snapshot.lookbacks);
        if (requestRevision === reviewLookbackRequestRevision) {
            reviewLookbackPreviews.value = previews;
        }
    } catch {
        if (requestRevision === reviewLookbackRequestRevision) {
            reviewLookbackPreviews.value = [];
        }
    } finally {
        if (requestRevision === reviewLookbackRequestRevision) {
            reviewLookbacksLoading.value = false;
        }
    }
}

const analyticsSnapshot = computed(() => {
    const journal = workspaceContext.value.selectedJournal;
    return journal
        ? buildJournalAnalyticsSnapshot(journal, props.state.anchorDate, props.plugin.settings, snapshotBuildOptions)
        : null;
});

const synthesisPreviews = computed<SynthesisPreviewModel[]>(() => {
    const journal = workspaceContext.value.selectedJournal;
    if (!journal) return [];

    return (['weekly', 'monthly', 'quarterly'] as SynthesisPeriodType[]).map(periodType => {
        const preview = buildSynthesisNotePreview(
            journal,
            props.state.anchorDate,
            props.plugin.settings,
            periodType,
            snapshotBuildOptions,
        );
        const filePath = normalizePath(`${journal.path}/${preview.fileName}`);
        return {
            preview,
            exists: !!props.plugin.app.vault.getFileByPath(filePath),
        };
    });
});

const remindersModel = computed<ReminderWorkspaceModel>(() => {
    const journalsWithRules = workspaceContext.value.journalFolders.map(journal => {
        const cadence = props.plugin.getJournalCadence(journal.path);
        const settings = props.plugin.getJournalReminderSettings(journal.path);
        const reviewReminderCount = Object.values(settings.reviewReminders)
            .filter(rule => rule.enabled).length;
        return {
            journalPath: journal.path,
            journalName: journal.name,
            cadenceType: cadence.type,
            cadenceLabel: getCadenceLabel(cadence),
            reminderSummary: props.plugin.getJournalReminderSummary(journal.path),
            entryReminderEnabled: settings.entryReminder.enabled,
            reviewReminderCount,
        };
    });

    return {
        remindersEnabled: props.plugin.areRemindersEnabled(),
        osNotificationsEnabled: props.plugin.areOsNotificationsEnabled(),
        permissionStatus: props.plugin.getNotificationPermissionStatus(),
        activeJournalCount: journalsWithRules.filter(journal => journal.reminderSummary === 'Reminders active').length,
        journals: journalsWithRules,
    };
});

async function loadJournalSettings() {
    const journalPath = props.state.journalPath;
    const requestRevision = ++journalSettingsRequestRevision;
    if (props.state.activeTab !== 'journals' || !journalPath) {
        journalSettingsModel.value = null;
        journalSettingsLoading.value = false;
        journalSettingsError.value = '';
        return;
    }

    journalSettingsLoading.value = true;
    journalSettingsError.value = '';
    try {
        const model = await props.actions.loadJournalSettings(journalPath);
        if (requestRevision !== journalSettingsRequestRevision) return;
        journalSettingsModel.value = model;
        if (!model) {
            journalSettingsError.value = 'Journalyst could not load that journal.';
        }
    } catch (error) {
        if (requestRevision !== journalSettingsRequestRevision) return;
        journalSettingsModel.value = null;
        journalSettingsError.value = error instanceof Error
            ? error.message
            : 'Journalyst could not load the journal settings.';
    } finally {
        if (requestRevision === journalSettingsRequestRevision) {
            journalSettingsLoading.value = false;
        }
    }
}

watch(
    [() => props.state.activeTab, () => props.state.journalPath],
    () => {
        journalEditorHasLocalChanges.value = false;
        void loadJournalSettings();
    },
    { immediate: true },
);

watch(() => props.state.revision, () => {
    if (props.state.activeTab === 'journals' && !journalEditorHasLocalChanges.value) {
        void loadJournalSettings();
    }
});

watch(
    [
        () => props.state.activeTab,
        () => props.state.journalPath,
        () => props.state.anchorDate,
        () => props.state.revision,
    ],
    () => void loadReviewLookbacks(),
    { immediate: true },
);

async function completeOnboarding(request: CompleteOnboardingRequest) {
    if (onboardingBusy.value) return;

    onboardingBusy.value = true;
    onboardingError.value = '';
    try {
        const result = await props.actions.completeOnboarding(request);
        if (!result.ok) {
            onboardingError.value = result.error;
        }
    } catch (error) {
        onboardingError.value = error instanceof Error
            ? error.message
            : 'Journalyst could not finish setup. Try again.';
    } finally {
        onboardingBusy.value = false;
    }
}

async function deferOnboarding() {
    if (onboardingBusy.value) return;

    onboardingBusy.value = true;
    onboardingError.value = '';
    try {
        await props.actions.deferOnboarding();
    } catch (error) {
        onboardingError.value = error instanceof Error
            ? error.message
            : 'Journalyst could not defer setup. Try again.';
    } finally {
        onboardingBusy.value = false;
    }
}

async function resumeOnboarding() {
    onboardingError.value = '';
    try {
        await props.actions.resumeOnboarding();
    } catch (error) {
        onboardingError.value = error instanceof Error
            ? error.message
            : 'Journalyst could not resume setup. Try again.';
    }
}

async function flushJournalSettings() {
    if (props.state.activeTab === 'journals') {
        return await journalsTab.value?.flushAutosave() ?? true;
    }
    return true;
}

defineExpose({ flushJournalSettings });
</script>

<template>
    <div class="journalyst-workspace">
        <OnboardingView
            v-if="onboardingModel.status === 'pending'"
            :model="onboardingModel"
            :busy="onboardingBusy"
            :error="onboardingError"
            @complete="completeOnboarding"
            @defer="deferOnboarding"
        />

        <div v-else-if="onboardingModel.status === 'deferred'" class="journalyst-onboarding-deferred">
            <header class="journalyst-onboarding-header">
                <h1>Journalyst</h1>
            </header>
            <main class="journalyst-onboarding-deferred-content" role="status">
                <ObsidianIcon name="folder-plus" />
                <h2>Journalyst is ready when you are</h2>
                <p>Choose a home folder and create your starting journals when you are ready to begin.</p>
                <p v-if="onboardingError" class="journalyst-onboarding-error" role="alert">
                    {{ onboardingError }}
                </p>
                <button type="button" class="mod-cta" @click="resumeOnboarding">
                    Resume setup
                    <ObsidianIcon name="arrow-right" />
                </button>
            </main>
        </div>

        <template v-else>
            <MainViewHeader
                v-model:active-tab="activeTab"
                :journals="journals"
                :tabs="tabs"
                @create-entry="actions.createEntry"
                @create-journal="actions.createJournal"
                @open-settings="actions.openSettings"
            />

            <div
                v-if="!selectedJournal && selectedJournalRequired"
                class="journalyst-review-empty"
                role="status"
            >
                <h2>Nothing to review yet</h2>
                <p>No journals are available for review. Choose another home directory in Journalyst settings or add a journal folder.</p>
            </div>

            <main v-else class="journalyst-workspace-content" role="tabpanel">
                <MainViewContextControls
                    v-if="selectedJournalRequired"
                    v-model:journal-path="journalPath"
                    v-model:anchor-date="anchorDate"
                    :journals="journals"
                />

                <HomeTab
                    v-if="state.activeTab === 'home'"
                    :summary="homeSummary"
                    :attention-items="homeAttentionItems"
                    :journals="homeJournals"
                    @create-entry="actions.createJournalEntry"
                    @activate-tab="actions.activateJournalTab"
                    @attention-action="activateHomeAttention"
                    @edit-journal="actions.activateJournalSettings($event, 'schedule')"
                />
                <JournalsTab
                    v-else-if="state.activeTab === 'journals'"
                    ref="journalsTab"
                    :journals="journalSidebarItems"
                    :model="journalSettingsModel"
                    :loading="journalSettingsLoading"
                    :error="journalSettingsError"
                    :active-section="state.journalSettingsSection"
                    :actions="actions"
                    @pending-change="journalEditorHasLocalChanges = $event"
                    @refresh="loadJournalSettings"
                />
                <ReviewTab
                    v-else-if="state.activeTab === 'review' && reviewSnapshot"
                    :snapshot="reviewSnapshot"
                    :lookback-previews="reviewLookbackPreviews"
                    :lookbacks-loading="reviewLookbacksLoading"
                    @open-note="actions.openNote"
                    @create-today="actions.createJournalEntry($event.journalPath, $event.date)"
                />
                <AnalyticsTab
                    v-else-if="state.activeTab === 'analytics' && analyticsSnapshot"
                    :snapshot="analyticsSnapshot"
                />
                <SynthesisTab
                    v-else-if="state.activeTab === 'synthesis'"
                    :previews="synthesisPreviews"
                    :focused-period="synthesisAttentionPeriod"
                    @open-note="actions.openNote"
                    @create-note="actions.createSynthesisNote(state.journalPath!, state.anchorDate, $event)"
                />
                <RemindersTab
                    v-else-if="state.activeTab === 'reminders'"
                    :model="remindersModel"
                    @update-reminders-enabled="actions.updateRemindersEnabled"
                    @update-os-notifications-enabled="actions.updateOsNotificationsEnabled"
                    @request-permission="actions.requestNotificationPermission"
                    @test-notification="actions.sendTestReminderNotification"
                    @edit-journal="actions.activateJournalSettings($event, 'reminders')"
                />
            </main>
        </template>
    </div>
</template>
