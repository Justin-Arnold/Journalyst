<script setup lang="ts">
import type { AnalyticsRankedWeek } from '../../../review/types';
import ObsidianIcon from '../ObsidianIcon.vue';
import WorkspaceSection from './WorkspaceSection.vue';

defineProps<{
    strongest: AnalyticsRankedWeek | null;
    lowest: AnalyticsRankedWeek | null;
}>();

const emit = defineEmits<{
    reviewWeek: [anchorDate: string];
}>();
</script>

<template>
    <WorkspaceSection title="Best and lowest weeks" description="The last 12 completed calendar weeks ranked by cadence-aware completion.">
        <div class="journalyst-analytics-ranked-weeks">
            <article v-if="strongest" class="journalyst-analytics-ranked-week">
                <div class="journalyst-analytics-ranked-label is-strongest">
                    <ObsidianIcon name="trophy" />
                    Strongest week
                </div>
                <h3>{{ strongest.label }}</h3>
                <p>{{ strongest.completedDays }}/{{ strongest.totalDays }} expected · {{ strongest.completionRate }}%</p>
                <button type="button" @click="emit('reviewWeek', strongest.reviewAnchorDate)">
                    <ObsidianIcon name="history" />
                    Review week
                </button>
            </article>
            <article v-else class="journalyst-analytics-ranked-week is-empty">
                <div class="journalyst-analytics-ranked-label">
                    <ObsidianIcon name="trophy" />
                    Strongest week
                </div>
                <h3>More history needed</h3>
                <p>Completed weeks will appear once this journal has a scored schedule.</p>
            </article>

            <article v-if="lowest" class="journalyst-analytics-ranked-week">
                <div class="journalyst-analytics-ranked-label is-lowest">
                    <ObsidianIcon name="trending-down" />
                    Lowest-completion week
                </div>
                <h3>{{ lowest.label }}</h3>
                <p>{{ lowest.completedDays }}/{{ lowest.totalDays }} expected · {{ lowest.completionRate }}%</p>
                <button type="button" @click="emit('reviewWeek', lowest.reviewAnchorDate)">
                    <ObsidianIcon name="history" />
                    Review week
                </button>
            </article>
            <article v-else class="journalyst-analytics-ranked-week is-empty">
                <div class="journalyst-analytics-ranked-label">
                    <ObsidianIcon name="trending-down" />
                    Lowest-completion week
                </div>
                <h3>More history needed</h3>
                <p>At least two scored weeks are needed for a meaningful comparison.</p>
            </article>
        </div>
    </WorkspaceSection>
</template>

<style scoped>
.journalyst-analytics-ranked-weeks {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    overflow: hidden;
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--journalyst-base-recessed);
}

.journalyst-analytics-ranked-week {
    display: flex;
    min-width: 0;
    min-height: 10rem;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--size-4-2);
    padding: var(--size-4-5);
}

.journalyst-analytics-ranked-week + .journalyst-analytics-ranked-week {
    border-left: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-analytics-ranked-week.is-empty {
    color: var(--text-faint);
}

.journalyst-analytics-ranked-label {
    display: inline-flex;
    align-items: center;
    gap: var(--size-4-2);
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    text-transform: uppercase;
}

.journalyst-analytics-ranked-label.is-strongest {
    color: var(--text-success);
}

.journalyst-analytics-ranked-label.is-lowest {
    color: var(--text-warning);
}

.journalyst-analytics-ranked-week h3,
.journalyst-analytics-ranked-week p {
    margin: 0;
    overflow-wrap: anywhere;
}

.journalyst-analytics-ranked-week h3 {
    color: var(--text-normal);
    font-size: var(--font-ui-medium);
}

.journalyst-analytics-ranked-week p {
    color: var(--text-faint);
    font-size: var(--font-ui-small);
}

.journalyst-analytics-ranked-week button {
    display: inline-flex;
    width: auto;
    align-items: center;
    gap: var(--size-4-2);
    margin-top: auto;
    border: 0;
    background: transparent;
    box-shadow: none;
    color: var(--text-muted);
}

.journalyst-analytics-ranked-week button:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
}

.journalyst-analytics-ranked-week button:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
}

@container (max-width: 40rem) {
    .journalyst-analytics-ranked-weeks {
        grid-template-columns: 1fr;
    }

    .journalyst-analytics-ranked-week {
        min-height: 9rem;
    }

    .journalyst-analytics-ranked-week + .journalyst-analytics-ranked-week {
        border-top: var(--border-width) solid var(--background-modifier-border);
        border-left: 0;
    }
}
</style>
