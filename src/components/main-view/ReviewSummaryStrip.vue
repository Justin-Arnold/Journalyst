<script setup lang="ts">
import { computed } from 'vue';
import moment from 'moment';
import type { JournalReviewSnapshot } from '../../../review/types';

const props = defineProps<{
    snapshot: JournalReviewSnapshot;
}>();

const streakValue = computed(() => props.snapshot.insights.isTracked
    ? `${props.snapshot.insights.currentStreak} ${props.snapshot.insights.currentStreak === 1 ? 'entry' : 'entries'}`
    : 'Flexible');
const streakDetail = computed(() => props.snapshot.insights.isTracked
    ? `Best ever: ${props.snapshot.insights.longestStreak}`
    : 'Not scored');
const monthValue = computed(() => {
    const summary = props.snapshot.currentMonthSummary;
    return summary.tracked && summary.totalDays > 0 ? `${summary.completionRate}%` : 'Not scored';
});
const monthDetail = computed(() => {
    const summary = props.snapshot.currentMonthSummary;
    if (!summary.tracked) return 'Flexible cadence';
    if (summary.totalDays === 0) return 'No entries expected';
    return `${summary.completedDays} of ${summary.totalDays} expected`;
});
const nextExpected = computed(() => {
    const date = props.snapshot.insights.nextExpectedDate;
    if (!date) return props.snapshot.insights.isTracked ? 'None scheduled' : 'Flexible';
    const today = moment().format('YYYY-MM-DD');
    if (date === today) return 'Today';
    if (date === moment().add(1, 'day').format('YYYY-MM-DD')) return 'Tomorrow';
    return moment(date, 'YYYY-MM-DD', true).format('MMM D, YYYY');
});
</script>

<template>
    <section class="journalyst-review-summary" aria-label="Journal review summary">
        <dl class="journalyst-review-summary-grid">
            <div class="journalyst-review-summary-metric">
                <dt class="journalyst-type-label">Cadence</dt>
                <dd>
                    <strong>{{ snapshot.insights.cadenceLabel }}</strong>
                    <span>At the anchor date</span>
                </dd>
            </div>
            <div class="journalyst-review-summary-metric">
                <dt class="journalyst-type-label">Current streak</dt>
                <dd>
                    <strong>{{ streakValue }}</strong>
                    <span>{{ streakDetail }}</span>
                </dd>
            </div>
            <div class="journalyst-review-summary-metric">
                <dt class="journalyst-type-label">This month</dt>
                <dd>
                    <strong>{{ monthValue }}</strong>
                    <span>{{ monthDetail }}</span>
                </dd>
            </div>
            <div class="journalyst-review-summary-metric">
                <dt class="journalyst-type-label">Next expected</dt>
                <dd>
                    <strong>{{ nextExpected }}</strong>
                    <span>From the anchor date</span>
                </dd>
            </div>
            <div class="journalyst-review-summary-metric">
                <dt class="journalyst-type-label">Total entries</dt>
                <dd>
                    <strong>{{ snapshot.entryCount.toLocaleString() }}</strong>
                    <span>Includes unfinished</span>
                </dd>
            </div>
        </dl>
    </section>
</template>

<style scoped>
.journalyst-review-summary {
    margin-bottom: var(--size-4-6);
}

.journalyst-review-summary-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    margin: 0;
    overflow: hidden;
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--journalyst-base-recessed);
}

.journalyst-review-summary-metric {
    min-width: 0;
    min-height: 7.25rem;
    padding: var(--size-4-4);
}

.journalyst-review-summary-metric + .journalyst-review-summary-metric {
    border-left: 3px solid var(--journalyst-accent-dark);
}

.journalyst-review-summary-metric dt {
    margin-bottom: var(--size-4-3);
    color: var(--text-muted);
}

.journalyst-review-summary-metric dd {
    display: flex;
    min-width: 0;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--size-4-2);
    margin: 0;
}

.journalyst-review-summary-metric strong {
    max-width: 100%;
    color: var(--text-normal);
    font-size: var(--journalyst-type-size-metric-medium);
    font-weight: var(--journalyst-type-weight-metric);
    line-height: var(--journalyst-type-line-tight);
    overflow-wrap: anywhere;
}

.journalyst-review-summary-metric span {
    color: var(--text-faint);
    font-size: var(--journalyst-type-size-supporting);
    overflow-wrap: anywhere;
}

@container (max-width: 56rem) {
    .journalyst-review-summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .journalyst-review-summary-metric:nth-child(odd) {
        border-left: 0;
    }

    .journalyst-review-summary-metric:nth-child(n + 3) {
        border-top: 3px solid var(--journalyst-accent-dark);
    }
}

@container (max-width: 27rem) {
    .journalyst-review-summary-grid {
        grid-template-columns: 1fr;
    }

    .journalyst-review-summary-metric {
        min-height: 0;
    }

    .journalyst-review-summary-metric + .journalyst-review-summary-metric {
        border-top: 3px solid var(--journalyst-accent-dark);
        border-left: 0;
    }
}
</style>
