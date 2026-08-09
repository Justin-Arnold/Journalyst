<script setup lang="ts">
import type { ReviewWorkspaceTab } from "../../../review/types";
import type {
    JournalHomeSummary,
    JournalOverviewData,
} from "../../../review/buildHomeSnapshot";
import HomeSummaryStrip from "./HomeSummaryStrip.vue";
import JournalActions from "./JournalActions.vue";
import JournalHeatmap from "./JournalHeatmap.vue";
import WorkspaceSection from "./WorkspaceSection.vue";

defineProps<{
    summary: JournalHomeSummary;
    journals: JournalOverviewData[];
}>();

const emit = defineEmits<{
    createEntry: [journalPath: string, date?: string];
    activateTab: [journalPath: string, tab: ReviewWorkspaceTab];
}>();
</script>

<template>
    <HomeSummaryStrip :summary="summary" />

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
