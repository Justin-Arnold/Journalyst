<script setup lang="ts">
import type { AnalyticsSummaryMetric } from '../../../review/types';

defineProps<{
    metrics: AnalyticsSummaryMetric[];
}>();
</script>

<template>
    <section class="journalyst-analytics-summary" aria-label="Analytics summary">
        <dl>
            <div v-for="metric in metrics" :key="metric.id">
                <dt class="journalyst-type-label">{{ metric.label }}</dt>
                <dd>
                    <strong class="journalyst-type-metric-large">{{ metric.value }}</strong>
                    <span>{{ metric.supportingText }}</span>
                    <span
                        v-if="metric.comparisonText"
                        class="journalyst-analytics-comparison"
                        :class="`is-${metric.comparisonTone}`"
                    >
                        {{ metric.comparisonText }}
                    </span>
                </dd>
            </div>
        </dl>
    </section>
</template>

<style scoped>
.journalyst-analytics-summary {
    margin-bottom: var(--size-4-6);
}

.journalyst-analytics-summary dl {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin: 0;
    overflow: hidden;
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--journalyst-base-recessed);
}

.journalyst-analytics-summary dl > div {
    min-width: 0;
    min-height: 8rem;
    padding: var(--size-4-5);
}

.journalyst-analytics-summary dl > div + div {
    border-left: 3px solid var(--journalyst-accent-dark);
}

.journalyst-analytics-summary dt {
    margin-bottom: var(--size-4-3);
    color: var(--text-muted);
}

.journalyst-analytics-summary dd {
    display: flex;
    min-width: 0;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--size-4-2);
    margin: 0;
}

.journalyst-analytics-summary strong {
    max-width: 100%;
    color: var(--text-normal);
    overflow-wrap: anywhere;
}

.journalyst-analytics-summary dd > span {
    color: var(--text-faint);
    font-size: var(--journalyst-type-size-supporting);
    overflow-wrap: anywhere;
}

.journalyst-analytics-comparison.is-success {
    color: var(--text-success);
}

.journalyst-analytics-comparison.is-warning {
    color: var(--text-warning);
}

@container (max-width: 48rem) {
    .journalyst-analytics-summary dl {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .journalyst-analytics-summary dl > div:nth-child(3) {
        grid-column: 1 / -1;
        border-top: 3px solid var(--journalyst-accent-dark);
        border-left: 0;
    }
}

@container (max-width: 28rem) {
    .journalyst-analytics-summary dl {
        grid-template-columns: 1fr;
    }

    .journalyst-analytics-summary dl > div {
        min-height: 0;
    }

    .journalyst-analytics-summary dl > div + div,
    .journalyst-analytics-summary dl > div:nth-child(3) {
        grid-column: auto;
        border-top: 3px solid var(--journalyst-accent-dark);
        border-left: 0;
    }
}
</style>
