<script setup lang="ts">
import { computed } from "vue";
import { normalizePath } from "obsidian";
import moment from "moment";
import { getCadenceLabel } from "../../cadence";
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
import AnalyticsTab from "./main-view/AnalyticsTab.vue";
import HomeTab from "./main-view/HomeTab.vue";
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
</script>

<template>
    <div class="journalyst-workspace">
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
            <p>No journals are available for review yet.</p>
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
    </div>
</template>
