<script setup lang="ts">
import type { JournalAnalyticsSnapshot } from '../../../review/types';
import AnalyticsCadencePerformance from './AnalyticsCadencePerformance.vue';
import AnalyticsChartPanel from './AnalyticsChartPanel.vue';
import AnalyticsInsights from './AnalyticsInsights.vue';
import AnalyticsRankedWeeks from './AnalyticsRankedWeeks.vue';
import AnalyticsSummaryStrip from './AnalyticsSummaryStrip.vue';
import WorkspaceSection from './WorkspaceSection.vue';
import YearCalendar from './YearCalendar.vue';

defineProps<{
    snapshot: JournalAnalyticsSnapshot;
}>();

const emit = defineEmits<{
    openNote: [filePath: string];
    reviewWeek: [anchorDate: string];
}>();
</script>

<template>
    <AnalyticsSummaryStrip :metrics="snapshot.summaryMetrics" />

    <AnalyticsInsights :insights="snapshot.patternInsights" />

    <section class="journalyst-analytics-chart-grid" aria-label="Journal patterns">
        <AnalyticsChartPanel :series="snapshot.weekdayRhythm" />
        <AnalyticsChartPanel :series="snapshot.monthlyVolume" />
    </section>

    <AnalyticsRankedWeeks
        :strongest="snapshot.rankedWeeks.strongest"
        :lowest="snapshot.rankedWeeks.lowest"
        @review-week="emit('reviewWeek', $event)"
    />

    <WorkspaceSection
        :title="`${snapshot.anchor.date.slice(0, 4)} at a glance`"
        description="One square per day, using the same completion and schedule states as Home and Review."
    >
        <YearCalendar :cells="snapshot.yearActivity" @open-note="emit('openNote', $event)" />
    </WorkspaceSection>

    <AnalyticsCadencePerformance
        :metrics="snapshot.cadencePerformance"
        :description="snapshot.cadencePerformanceDescription"
    />
</template>

<style scoped>
.journalyst-analytics-chart-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--size-4-4);
    margin-bottom: var(--size-4-6);
}

@container (max-width: 58rem) {
    .journalyst-analytics-chart-grid {
        grid-template-columns: 1fr;
    }
}
</style>
