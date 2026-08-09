<script setup lang="ts">
import { computed } from "vue";
import type { JournalHomeSummary } from "../../../review/buildHomeSnapshot";

const props = defineProps<{
    summary: JournalHomeSummary;
}>();

const journalCountText = computed(() => `${props.summary.totalJournals} journal${props.summary.totalJournals === 1 ? '' : 's'}`);
const dueTodayUnit = computed(() => props.summary.dueTodayCount === 1 ? 'journal' : 'journals');
const totalEntriesText = computed(() => props.summary.totalEntries.toLocaleString());
const currentStreakText = computed(() => `${props.summary.currentStreak} day${props.summary.currentStreak === 1 ? '' : 's'}`);
const longestStreakText = computed(() => `Best ever: ${props.summary.longestStreak} day${props.summary.longestStreak === 1 ? '' : 's'}`);
</script>

<template>
    <section class="journalyst-home-summary" aria-label="Journal overview">
        <dl class="journalyst-home-summary-grid">
            <div class="journalyst-home-summary-metric">
                <dt>Due today</dt>
                <dd>
                    <span class="journalyst-home-summary-value">
                        <strong>{{ summary.dueTodayCount }}</strong>
                        <span>{{ dueTodayUnit }}</span>
                    </span>
                    <span class="journalyst-home-summary-detail">
                        out of {{ journalCountText }}
                    </span>
                </dd>
            </div>

            <div class="journalyst-home-summary-metric">
                <dt>Total entries</dt>
                <dd>
                    <strong>{{ totalEntriesText }}</strong>
                    <span class="journalyst-home-summary-detail">
                        All time
                    </span>
                </dd>
            </div>

            <div class="journalyst-home-summary-metric">
                <dt>Reminders</dt>
                <dd>
                    <span class="journalyst-home-summary-value">
                        <strong>{{ summary.remindersActiveCount }}</strong>
                        <span>active</span>
                    </span>
                    <span class="journalyst-home-summary-detail">
                        {{ summary.remindersInactiveCount }} off
                    </span>
                </dd>
            </div>

            <div class="journalyst-home-summary-metric">
                <dt>Current streak</dt>
                <dd>
                    <strong>{{ currentStreakText }}</strong>
                    <span class="journalyst-home-summary-detail">
                        {{ longestStreakText }}
                    </span>
                </dd>
            </div>
        </dl>
    </section>
</template>

<style scoped>
.journalyst-home-summary {
    margin-bottom: var(--size-4-6);
}

.journalyst-home-summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    margin: 0;
    overflow: hidden;
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--journalyst-base-recessed);
}

.journalyst-home-summary-metric {
    min-width: 0;
    min-height: 8.5rem;
    padding: var(--size-4-5);
}

.journalyst-home-summary-metric + .journalyst-home-summary-metric {
    border-left: 3px solid var(--journalyst-accent-dark);
}

.journalyst-home-summary-metric dt {
    margin-bottom: var(--size-4-3);
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    text-transform: uppercase;
    letter-spacing: 0;
}

.journalyst-home-summary-metric dd {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--size-4-2);
    margin: 0;
    color: var(--text-normal);
}

.journalyst-home-summary-metric strong {
    font-size: 1.75rem;
    line-height: 1;
}

.journalyst-home-summary-value {
    display: inline-flex;
    align-items: baseline;
    gap: var(--size-4-2);
    color: var(--text-muted);
}

.journalyst-home-summary-value strong {
    color: var(--text-normal);
}

.journalyst-home-summary-detail {
    display: inline-flex;
    align-items: center;
    gap: var(--size-4-1);
    min-width: 0;
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    overflow-wrap: anywhere;
}

@media (max-width: 700px) {
    .journalyst-home-summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .journalyst-home-summary-metric:nth-child(n + 3) {
        border-top: 3px solid var(--journalyst-accent-dark);
    }

    .journalyst-home-summary-metric:nth-child(3) {
        border-left: 0;
    }
}

@media (max-width: 430px) {
    .journalyst-home-summary-grid {
        grid-template-columns: 1fr;
    }

    .journalyst-home-summary-metric {
        min-height: 0;
    }

    .journalyst-home-summary-metric + .journalyst-home-summary-metric {
        border-left: 0;
        border-top: 3px solid var(--journalyst-accent-dark);
    }
}
</style>
