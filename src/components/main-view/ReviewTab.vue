<script setup lang="ts">
import { computed } from "vue";
import type { JournalReviewSnapshot } from "../../../review/types";
import ActivityStrip from "./ActivityStrip.vue";
import CalloutGrid from "./CalloutGrid.vue";
import PeriodSummaryGrid from "./PeriodSummaryGrid.vue";
import WorkspaceOverview from "./WorkspaceOverview.vue";
import WorkspaceSection from "./WorkspaceSection.vue";

const props = defineProps<{
    snapshot: JournalReviewSnapshot;
}>();

const emit = defineEmits<{
    openNote: [filePath: string];
}>();

const overviewStats = computed(() => [
    { label: 'Cadence', value: props.snapshot.insights.cadenceLabel },
    { label: 'Current streak', value: props.snapshot.insights.isTracked ? `${props.snapshot.insights.currentStreak}` : 'Off' },
    { label: 'Missed now', value: props.snapshot.insights.isTracked ? `${props.snapshot.insights.outstandingMisses}` : 'Off' },
    { label: 'Next expected', value: props.snapshot.insights.nextExpectedDate ?? 'Flexible' },
]);

const insightCards = computed(() => [
    { label: 'Current streak', value: props.snapshot.insights.isTracked ? `${props.snapshot.insights.currentStreak} expected hits` : 'Not tracked' },
    { label: 'Longest streak', value: props.snapshot.insights.isTracked ? `${props.snapshot.insights.longestStreak} expected hits` : 'Not tracked' },
    { label: 'Longest miss stretch', value: props.snapshot.insights.isTracked ? `${props.snapshot.insights.longestMissStretch} misses` : 'Not tracked' },
    { label: 'Total entries', value: `${props.snapshot.insights.totalEntries}` },
    { label: 'Expected today', value: props.snapshot.insights.isTracked ? (props.snapshot.insights.expectedToday ? 'Yes' : 'No') : 'Flexible' },
    { label: 'Outstanding misses', value: props.snapshot.insights.isTracked ? `${props.snapshot.insights.outstandingMisses}` : 'Flexible' },
]);
</script>

<template>
    <WorkspaceOverview
        :title="snapshot.journalName"
        :description="`Review anchored to ${snapshot.anchor.date}. Track consistency, revisit old notes, and turn patterns into reflection.`"
        :stats="overviewStats"
    />

    <CalloutGrid title="Highlights" :callouts="snapshot.reviewCallouts" />

    <WorkspaceSection title="Lookbacks" description="See what you wrote around this same point in prior periods.">
        <div class="journalyst-review-list">
            <button
                v-for="lookback in snapshot.lookbacks"
                :key="lookback.label"
                type="button"
                class="journalyst-review-lookback"
                :disabled="!lookback.entry"
                @click="lookback.entry && emit('openNote', lookback.entry.filePath)"
            >
                <span class="journalyst-review-label">{{ lookback.label }}</span>
                <strong>{{ lookback.targetDate }}</strong>
                <span v-if="lookback.entry" class="journalyst-review-meta">Open entry</span>
                <span v-else class="journalyst-review-empty-text">No note for this date yet</span>
            </button>
        </div>
    </WorkspaceSection>

    <WorkspaceSection title="Recent activity" description="A quick read on the last 35 days.">
        <div class="journalyst-review-activity-surface">
            <ActivityStrip :cells="snapshot.recentActivity" />
        </div>
    </WorkspaceSection>

    <PeriodSummaryGrid title="Calendar summary" :summaries="snapshot.calendarSummaries" />
    <PeriodSummaryGrid title="Rolling summary" :summaries="snapshot.rollingSummaries" />

    <WorkspaceSection title="Insights">
        <div class="journalyst-review-grid">
            <article v-for="insight in insightCards" :key="insight.label" class="journalyst-review-card">
                <span class="journalyst-review-label">{{ insight.label }}</span>
                <strong>{{ insight.value }}</strong>
            </article>
        </div>
    </WorkspaceSection>
</template>
