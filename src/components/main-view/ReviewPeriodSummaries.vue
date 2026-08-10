<script setup lang="ts">
import type { PeriodSummary } from '../../../review/types';

defineProps<{
    calendarSummaries: PeriodSummary[];
    rollingSummaries: PeriodSummary[];
}>();

function getSummaryText(summary: PeriodSummary) {
    if (!summary.tracked) return 'Not scored';
    if (summary.totalDays === 0) return 'No entries expected';
    return `${summary.completedDays}/${summary.totalDays} · ${summary.completionRate}%`;
}
</script>

<template>
    <div class="journalyst-review-period-layout">
        <section class="journalyst-review-period-panel">
            <header>
                <h2>Calendar summary</h2>
                <p>Fixed calendar windows through the anchor date.</p>
            </header>
            <div class="journalyst-review-period-list">
                <div
                    v-for="summary in calendarSummaries"
                    :key="`${summary.label}-${summary.startDate}`"
                    class="journalyst-review-period-row"
                >
                    <span>{{ summary.label }}</span>
                    <div
                        v-if="summary.tracked && summary.totalDays > 0"
                        class="journalyst-review-period-meter"
                        :class="{ 'is-complete': summary.completionRate === 100 }"
                        role="progressbar"
                        :aria-label="`${summary.label}: ${summary.completionRate}% complete`"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        :aria-valuenow="summary.completionRate"
                    >
                        <span :style="{ width: `${summary.completionRate}%` }" />
                    </div>
                    <strong>{{ getSummaryText(summary) }}</strong>
                </div>
            </div>
        </section>

        <section class="journalyst-review-period-panel">
            <header>
                <h2>Rolling summary</h2>
                <p>Rolling windows ending at the anchor date.</p>
            </header>
            <div class="journalyst-review-period-list">
                <div
                    v-for="summary in rollingSummaries"
                    :key="`${summary.label}-${summary.startDate}`"
                    class="journalyst-review-period-row"
                >
                    <span>{{ summary.label }}</span>
                    <div
                        v-if="summary.tracked && summary.totalDays > 0"
                        class="journalyst-review-period-meter"
                        :class="{ 'is-complete': summary.completionRate === 100 }"
                        role="progressbar"
                        :aria-label="`${summary.label}: ${summary.completionRate}% complete`"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        :aria-valuenow="summary.completionRate"
                    >
                        <span :style="{ width: `${summary.completionRate}%` }" />
                    </div>
                    <strong>{{ getSummaryText(summary) }}</strong>
                </div>
            </div>
        </section>
    </div>
</template>

<style scoped>
.journalyst-review-period-layout {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--size-4-4);
    margin-bottom: var(--size-4-6);
}

.journalyst-review-period-panel {
    min-width: 0;
}

.journalyst-review-period-panel header {
    display: flex;
    min-width: 0;
    align-items: baseline;
    gap: var(--size-4-3);
    margin-bottom: var(--size-4-3);
    padding-bottom: var(--size-4-2);
    border-bottom: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-review-period-panel h2,
.journalyst-review-period-panel p {
    margin: 0;
}

.journalyst-review-period-panel h2 {
    flex: 0 0 auto;
    color: var(--text-normal);
    font-size: var(--font-ui-medium);
}

.journalyst-review-period-panel p {
    min-width: 0;
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    overflow-wrap: anywhere;
}

.journalyst-review-period-list {
    overflow: hidden;
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--journalyst-base-recessed);
}

.journalyst-review-period-row {
    display: grid;
    grid-template-columns: minmax(7rem, 1fr) minmax(5rem, 7rem) minmax(5.5rem, auto);
    min-width: 0;
    align-items: center;
    gap: var(--size-4-3);
    padding: var(--size-4-3) var(--size-4-4);
}

.journalyst-review-period-row + .journalyst-review-period-row {
    border-top: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-review-period-row > span {
    min-width: 0;
    color: var(--text-normal);
    overflow-wrap: anywhere;
}

.journalyst-review-period-row strong {
    color: var(--text-muted);
    font-size: var(--font-ui-small);
    font-weight: 500;
    text-align: right;
    white-space: nowrap;
}

.journalyst-review-period-meter {
    height: 0.45rem;
    overflow: hidden;
    border-radius: var(--radius-s);
    background: var(--background-modifier-border);
}

.journalyst-review-period-meter span {
    display: block;
    height: 100%;
    background: var(--interactive-accent);
}

.journalyst-review-period-meter.is-complete span {
    background: var(--text-success);
}

@container (max-width: 53rem) {
    .journalyst-review-period-layout {
        grid-template-columns: 1fr;
    }
}

@container (max-width: 30rem) {
    .journalyst-review-period-panel header {
        align-items: flex-start;
        flex-direction: column;
        gap: var(--size-4-1);
    }

    .journalyst-review-period-row {
        grid-template-columns: minmax(0, 1fr) auto;
    }

    .journalyst-review-period-meter {
        grid-column: 1 / -1;
        grid-row: 2;
    }
}
</style>
