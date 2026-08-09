<script setup lang="ts">
import type { PeriodSummary } from "../../../review/types";
import WorkspaceSection from "./WorkspaceSection.vue";

defineProps<{
    title: string;
    summaries: PeriodSummary[];
}>();
</script>

<template>
    <WorkspaceSection :title="title">
        <div class="journalyst-review-grid">
            <article v-for="summary in summaries" :key="`${summary.label}-${summary.startDate}`" class="journalyst-review-card">
                <span class="journalyst-review-label">{{ summary.label }}</span>
                <template v-if="summary.tracked">
                    <div class="journalyst-review-stat-row">
                        <strong>{{ summary.completedDays }}/{{ summary.totalDays }}</strong>
                        <span class="journalyst-review-emphasis">{{ summary.completionRate }}%</span>
                    </div>
                    <div
                        class="journalyst-review-meter"
                        role="progressbar"
                        aria-label="Completion rate"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        :aria-valuenow="summary.completionRate"
                    >
                        <div class="journalyst-review-meter-fill" :style="{ width: `${summary.completionRate}%` }" />
                    </div>
                    <span class="journalyst-review-meta">{{ summary.completionRate }}% of expected entries</span>
                </template>
                <template v-else>
                    <strong>Not tracked</strong>
                    <span class="journalyst-review-meta">This journal uses an ad hoc cadence, so completion is not scored.</span>
                </template>
                <span class="journalyst-review-meta">{{ summary.startDate }} to {{ summary.endDate }}</span>
            </article>
        </div>
    </WorkspaceSection>
</template>
