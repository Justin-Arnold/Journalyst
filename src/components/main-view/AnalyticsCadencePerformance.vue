<script setup lang="ts">
import type { AnalyticsPerformanceMetric } from '../../../review/types';
import WorkspaceSection from './WorkspaceSection.vue';

defineProps<{
    metrics: AnalyticsPerformanceMetric[];
    description: string;
}>();
</script>

<template>
    <WorkspaceSection title="Cadence performance" :description="description">
        <div class="journalyst-analytics-performance">
            <div v-for="metric in metrics" :key="metric.id" class="journalyst-analytics-performance-row">
                <div>
                    <strong>{{ metric.label }}</strong>
                    <span>{{ metric.description }}</span>
                </div>
                <div class="journalyst-analytics-performance-result">
                    <span
                        class="journalyst-analytics-performance-meter"
                        :class="{ 'is-complete': metric.percentage === 100 }"
                        role="progressbar"
                        :aria-label="metric.label"
                        :aria-valuemin="0"
                        :aria-valuemax="100"
                        :aria-valuenow="metric.tracked ? metric.percentage : 0"
                    >
                        <span v-if="metric.tracked" :style="{ width: `${metric.percentage}%` }" />
                    </span>
                    <strong v-if="metric.tracked">
                        {{ metric.completed }}/{{ metric.total }} · {{ metric.percentage }}%
                    </strong>
                    <strong v-else>Not scored</strong>
                </div>
            </div>
        </div>
    </WorkspaceSection>
</template>

<style scoped>
.journalyst-analytics-performance {
    overflow: hidden;
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--journalyst-base-recessed);
}

.journalyst-analytics-performance-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(16rem, 24rem);
    min-width: 0;
    align-items: center;
    gap: var(--size-4-5);
    padding: var(--size-4-4) var(--size-4-5);
}

.journalyst-analytics-performance-row + .journalyst-analytics-performance-row {
    border-top: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-analytics-performance-row > div:first-child {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: var(--size-4-1);
}

.journalyst-analytics-performance-row strong {
    color: var(--text-normal);
    font-size: var(--font-ui-small);
    font-weight: 500;
}

.journalyst-analytics-performance-row span {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    overflow-wrap: anywhere;
}

.journalyst-analytics-performance-result {
    display: grid;
    grid-template-columns: minmax(5rem, 1fr) minmax(7rem, auto);
    align-items: center;
    gap: var(--size-4-3);
}

.journalyst-analytics-performance-result > strong {
    color: var(--text-muted);
    text-align: right;
    white-space: nowrap;
}

.journalyst-analytics-performance-meter {
    display: block;
    height: 0.5rem;
    overflow: hidden;
    border-radius: var(--radius-s);
    background: var(--background-modifier-border);
}

.journalyst-analytics-performance-meter > span {
    display: block;
    height: 100%;
    background: var(--interactive-accent);
}

.journalyst-analytics-performance-meter.is-complete > span {
    background: var(--text-success);
}

@container (max-width: 44rem) {
    .journalyst-analytics-performance-row {
        grid-template-columns: 1fr;
        gap: var(--size-4-3);
    }
}

@container (max-width: 26rem) {
    .journalyst-analytics-performance-result {
        grid-template-columns: 1fr;
    }

    .journalyst-analytics-performance-result > strong {
        text-align: left;
    }
}
</style>
