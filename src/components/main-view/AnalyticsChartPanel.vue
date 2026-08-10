<script setup lang="ts">
import { computed } from 'vue';
import type { AnalyticsChartSeries } from '../../../review/types';

const props = defineProps<{
    series: AnalyticsChartSeries;
}>();

const maxValue = computed(() => Math.max(...props.series.data.map(item => item.value), 1));

function getBarHeight(value: number) {
    return `${Math.max(5, (value / maxValue.value) * 100)}%`;
}
</script>

<template>
    <article class="journalyst-analytics-chart-panel" :class="`is-${series.id}`">
        <header>
            <div>
                <h2>{{ series.title }}</h2>
                <p>{{ series.description }}</p>
            </div>
            <strong>{{ series.totalLabel }}</strong>
        </header>

        <div class="journalyst-analytics-chart-scroll">
            <div
                class="journalyst-analytics-chart"
                :style="{ gridTemplateColumns: `repeat(${series.data.length}, minmax(0, 1fr))` }"
                role="list"
                :aria-label="`${series.title}. ${series.totalLabel}`"
            >
                <div
                    v-for="item in series.data"
                    :key="item.key"
                    class="journalyst-analytics-chart-column"
                    :title="`${item.label}: ${item.valueLabel}. ${item.description}`"
                    :aria-label="`${item.label}: ${item.valueLabel}. ${item.description}`"
                    role="listitem"
                >
                    <span class="journalyst-analytics-chart-value">{{ item.valueLabel }}</span>
                    <span class="journalyst-analytics-chart-track" aria-hidden="true">
                        <span
                            class="journalyst-analytics-chart-bar"
                            :class="{
                                'is-highlight': item.isHighlight,
                                'is-empty': item.isEmpty,
                            }"
                            :style="{ height: getBarHeight(item.value) }"
                        />
                    </span>
                    <span class="journalyst-analytics-chart-label">{{ item.label }}</span>
                </div>
            </div>
        </div>
    </article>
</template>

<style scoped>
.journalyst-analytics-chart-panel {
    display: flex;
    min-width: 0;
    min-height: 21rem;
    flex-direction: column;
    padding: var(--size-4-5);
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--journalyst-base-recessed);
}

.journalyst-analytics-chart-panel header {
    display: flex;
    min-width: 0;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--size-4-4);
    margin-bottom: var(--size-4-5);
}

.journalyst-analytics-chart-panel h2,
.journalyst-analytics-chart-panel p {
    margin: 0;
}

.journalyst-analytics-chart-panel h2 {
    color: var(--text-normal);
    font-size: var(--font-ui-medium);
    text-transform: uppercase;
}

.journalyst-analytics-chart-panel p,
.journalyst-analytics-chart-panel header strong {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    font-weight: 400;
    overflow-wrap: anywhere;
}

.journalyst-analytics-chart-panel p {
    margin-top: var(--size-4-1);
}

.journalyst-analytics-chart-panel header strong {
    flex: 0 0 auto;
    text-align: right;
}

.journalyst-analytics-chart-scroll {
    min-width: 0;
    margin-top: auto;
    overflow-x: auto;
}

.journalyst-analytics-chart {
    display: grid;
    min-width: 28rem;
    height: 14rem;
    align-items: stretch;
    gap: var(--size-4-2);
}

.journalyst-analytics-chart-panel.is-monthly .journalyst-analytics-chart {
    min-width: 42rem;
}

.journalyst-analytics-chart-column {
    display: grid;
    min-width: 0;
    grid-template-rows: 1.25rem minmax(0, 1fr) 1.25rem;
    align-items: end;
    gap: var(--size-4-2);
    color: var(--text-muted);
    text-align: center;
}

.journalyst-analytics-chart-value,
.journalyst-analytics-chart-label {
    overflow: hidden;
    font-size: var(--font-ui-smaller);
    text-overflow: ellipsis;
    white-space: nowrap;
}

.journalyst-analytics-chart-value {
    color: var(--text-faint);
}

.journalyst-analytics-chart-track {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: flex-end;
}

.journalyst-analytics-chart-bar {
    display: block;
    width: 100%;
    min-height: 0.35rem;
    border: var(--border-width) solid var(--journalyst-accent-dark);
    border-radius: 3px 3px 0 0;
    background: var(--journalyst-accent-dark);
}

.journalyst-analytics-chart-bar.is-highlight {
    border-color: var(--interactive-accent);
    background: var(--interactive-accent);
}

.journalyst-analytics-chart-bar.is-empty {
    border-color: var(--background-modifier-border);
    border-style: dashed;
    background: transparent;
}

@container (max-width: 34rem) {
    .journalyst-analytics-chart-panel {
        min-height: 18rem;
        padding: var(--size-4-4);
    }

    .journalyst-analytics-chart-panel header {
        flex-direction: column;
        gap: var(--size-4-2);
    }

    .journalyst-analytics-chart-panel header strong {
        text-align: left;
    }

    .journalyst-analytics-chart {
        height: 12rem;
    }
}
</style>
