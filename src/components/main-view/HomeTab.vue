<script setup lang="ts">
import { computed } from "vue";
import type { AnalyticsCallout, ReviewWorkspaceTab, SidebarMode } from "../../../review/types";
import type {
    JournalHomeSummary,
    JournalOverviewData,
} from "../../../review/buildHomeSnapshot";
import CalloutGrid from "./CalloutGrid.vue";
import JournalActions from "./JournalActions.vue";
import JournalHeatmap from "./JournalHeatmap.vue";
import WorkspaceOverview from "./WorkspaceOverview.vue";
import WorkspaceSection from "./WorkspaceSection.vue";

const props = defineProps<{
    summary: JournalHomeSummary;
    journals: JournalOverviewData[];
}>();

const emit = defineEmits<{
    openSidebar: [mode: SidebarMode];
    createEntry: [journalPath: string, date?: string];
    activateTab: [journalPath: string, tab: ReviewWorkspaceTab];
}>();

const stats = computed(() => [
    { label: 'Journals', value: `${props.summary.totalJournals}` },
    { label: 'Due now', value: `${props.summary.dueTodayCount}` },
    { label: 'Missed', value: `${props.summary.missedCount}` },
    { label: 'Reminders active', value: `${props.summary.remindersActiveCount}` },
]);

const callouts = computed<AnalyticsCallout[]>(() => {
    const items: AnalyticsCallout[] = [];
    if (props.summary.dueTodayCount > 0) {
        items.push({
            title: 'Due today',
            body: `${props.summary.dueTodayCount} journal${props.summary.dueTodayCount === 1 ? '' : 's'} need attention today.`,
        });
    }
    if (props.summary.missedCount > 0) {
        items.push({
            title: 'Misses to revisit',
            body: `${props.summary.missedCount} missed expected entries are still outstanding.`,
        });
    }
    if (props.summary.remindersActiveCount > 0) {
        items.push({
            title: 'Reminders running',
            body: `${props.summary.remindersActiveCount} journal${props.summary.remindersActiveCount === 1 ? '' : 's'} have active reminder rules.`,
        });
    }
    return items;
});

function handleOverviewAction(actionId: string) {
    emit('openSidebar', actionId === 'home-sidebar' ? 'home-mini' : 'journals-mini');
}
</script>

<template>
    <WorkspaceOverview
        title="Home"
        description="A current read on your journals, scheduled entries, and reminders."
        :stats="stats"
        :actions="[
            { id: 'home-sidebar', label: 'Home sidebar' },
            { id: 'journals-sidebar', label: 'Journals sidebar' },
        ]"
        @action="handleOverviewAction"
    />

    <CalloutGrid title="Right now" :callouts="callouts" />

    <WorkspaceSection title="Journals" description="Create an entry, scan this month, or move into deeper review.">
        <div class="journalyst-home-grid">
            <article v-for="overview in journals" :key="overview.journal.path" class="journalyst-home-card">
                <div class="journalyst-home-card-header">
                    <h3>{{ overview.journal.name }}</h3>
                    <span
                        class="journalyst-home-status-badge"
                        :class="{ 'is-due': overview.dueToday, 'is-missed': !overview.dueToday && overview.outstandingMisses > 0 }"
                    >
                        {{ overview.cadenceStatusText }}
                    </span>
                </div>
                <div class="journalyst-home-card-meta">
                    <span class="journalyst-review-meta">{{ overview.cadenceLabel }}</span>
                    <span class="journalyst-review-meta">{{ overview.reminderStatusText }}</span>
                </div>
                <JournalHeatmap
                    :days="overview.heatmapDays"
                    @select="emit('createEntry', overview.journal.path, $event)"
                />
                <JournalActions
                    :today-exists="!!overview.todayFile"
                    include-synthesis
                    @today="emit('createEntry', overview.journal.path)"
                    @navigate="emit('activateTab', overview.journal.path, $event)"
                />
            </article>
        </div>
    </WorkspaceSection>
</template>
