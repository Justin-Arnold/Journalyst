<script setup lang="ts">
import { computed, ref } from "vue";
import { normalizePath } from "obsidian";
import moment from "moment";
import { getCadenceLabel } from "../../cadence";
import type { CompleteOnboardingRequest } from "../../onboarding";
import {
    buildJournalHomeSummary,
    buildJournalOverviewData,
} from "../../review/buildHomeSnapshot";
import {
    buildJournalAnalyticsSnapshot,
    buildJournalReviewSnapshot,
    buildSynthesisNotePreview,
} from "../../review/buildSnapshot";
import type {
    ReviewWorkspaceTab,
    SynthesisPeriodType,
} from "../../review/types";
import type JournalystPlugin from "../main";
import MainViewNavigationTabs from "./MainViewNavigationTabs.vue";
import ObsidianIcon from "./ObsidianIcon.vue";
import AnalyticsTab from "./main-view/AnalyticsTab.vue";
import HomeTab from "./main-view/HomeTab.vue";
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

const props = defineProps<{
    plugin: JournalystPlugin;
    state: ReviewViewState;
    actions: MainViewActions;
}>();

const onboardingBusy = ref(false);
const onboardingError = ref('');

const tabs: Array<{ id: ReviewWorkspaceTab; label: string; icon: string }> = [
    { id: 'home', label: 'Home', icon: 'house' },
    { id: 'review', label: 'Review', icon: 'history' },
    { id: 'analytics', label: 'Analytics', icon: 'chart-column' },
    { id: 'synthesis', label: 'Synthesis', icon: 'file-pen-line' },
    { id: 'reminders', label: 'Reminders', icon: 'bell' },
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

const selectedJournal = computed(() => workspaceContext.value.selectedJournal);

const onboardingModel = computed(() => {
    void workspaceContext.value.revision;
    return props.plugin.getOnboardingViewModel();
});

const activeTab = computed<ReviewWorkspaceTab>({
    get: () => props.state.activeTab,
    set: (value) => {
        void props.actions.setReviewState(props.state.journalPath, props.state.anchorDate, value);
    },
});

const homeWorkspace = computed(() => ({
    revision: workspaceContext.value.revision,
    summary: buildJournalHomeSummary(props.plugin),
    journals: workspaceContext.value.journalFolders
        .map(journal => buildJournalOverviewData(props.plugin, journal)),
}));

const homeSummary = computed(() => homeWorkspace.value.summary);
const homeJournals = computed(() => homeWorkspace.value.journals);

const reviewSnapshot = computed(() => {
    const journal = workspaceContext.value.selectedJournal;
    return journal
        ? buildJournalReviewSnapshot(journal, props.state.anchorDate, props.plugin.settings)
        : null;
});

const analyticsSnapshot = computed(() => {
    const journal = workspaceContext.value.selectedJournal;
    return journal
        ? buildJournalAnalyticsSnapshot(journal, props.state.anchorDate, props.plugin.settings)
        : null;
});

const synthesisPreviews = computed<SynthesisPreviewModel[]>(() => {
    const journal = workspaceContext.value.selectedJournal;
    if (!journal) return [];

    return (['weekly', 'monthly', 'quarterly'] as SynthesisPeriodType[]).map(periodType => {
        const preview = buildSynthesisNotePreview(journal, props.state.anchorDate, props.plugin.settings, periodType);
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
        return {
            journalPath: journal.path,
            journalName: journal.name,
            cadenceType: cadence.type,
            cadenceLabel: getCadenceLabel(cadence),
            reminderSummary: props.plugin.getJournalReminderSummary(journal.path),
            settings: props.plugin.getJournalReminderSettings(journal.path),
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

function getSelectValue(event: Event) {
    return (event.target as HTMLSelectElement).value;
}

function getInputValue(event: Event) {
    return (event.target as HTMLInputElement).value;
}

function selectJournal(journalPath: string) {
    void props.actions.setReviewState(journalPath || null, props.state.anchorDate, props.state.activeTab);
}

function selectAnchorDate(anchorDate: string) {
    void props.actions.setReviewState(
        props.state.journalPath,
        anchorDate || moment().format('YYYY-MM-DD'),
        props.state.activeTab,
    );
}

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
            <header class="journalyst-review-header">
                <h1>Journalyst</h1>
                <div v-if="state.activeTab !== 'home'" class="journalyst-review-controls">
                    <label class="journalyst-review-control">
                        <span>Journal</span>
                        <select :value="state.journalPath ?? ''" @change="selectJournal(getSelectValue($event))">
                            <option v-for="journal in journals" :key="journal.path" :value="journal.path">
                                {{ journal.name }}
                            </option>
                        </select>
                    </label>
                    <label class="journalyst-review-control">
                        <span>Anchor date</span>
                        <input type="date" :value="state.anchorDate" @change="selectAnchorDate(getInputValue($event))">
                    </label>
                </div>
            </header>

            <MainViewNavigationTabs v-model:active-tab="activeTab" :tabs="tabs" />

            <div
                v-if="!selectedJournal"
                class="journalyst-review-empty"
                role="status"
            >
                <h2>Nothing to review yet</h2>
                <p>No journals are available for review. Choose another home directory in Journalyst settings or add a journal folder.</p>
            </div>

            <main v-else class="journalyst-workspace-content" role="tabpanel">
                <HomeTab
                    v-if="state.activeTab === 'home'"
                    :summary="homeSummary"
                    :journals="homeJournals"
                    @open-sidebar="actions.openSidebar"
                    @create-entry="actions.createJournalEntry"
                    @activate-tab="actions.activateJournalTab"
                />
                <ReviewTab
                    v-else-if="state.activeTab === 'review' && reviewSnapshot"
                    :snapshot="reviewSnapshot"
                    @open-note="actions.openNote"
                />
                <AnalyticsTab
                    v-else-if="state.activeTab === 'analytics' && analyticsSnapshot"
                    :snapshot="analyticsSnapshot"
                />
                <SynthesisTab
                    v-else-if="state.activeTab === 'synthesis'"
                    :previews="synthesisPreviews"
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
                    @update-journal-settings="actions.updateJournalReminderSettings"
                />
            </main>
        </template>
    </div>
</template>
