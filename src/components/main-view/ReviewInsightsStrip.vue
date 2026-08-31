<script setup lang="ts">
import { computed } from 'vue';
import type { JournalReviewSnapshot } from '../../../review/types';
import WorkspaceSection from './WorkspaceSection.vue';

const props = defineProps<{
    snapshot: JournalReviewSnapshot;
}>();

const items = computed(() => [
    {
        label: 'Longest streak',
        value: props.snapshot.insights.isTracked
            ? `${props.snapshot.insights.longestStreak} ${props.snapshot.insights.longestStreak === 1 ? 'entry' : 'entries'}`
            : 'Not scored',
    },
    {
        label: 'Longest gap',
        value: props.snapshot.insights.isTracked
            ? `${props.snapshot.insights.longestMissStretch} ${props.snapshot.insights.longestMissStretch === 1 ? 'entry' : 'entries'}`
            : 'Not scored',
    },
    { label: 'Busiest weekday', value: props.snapshot.insights.busiestWeekday ?? 'No pattern yet' },
    { label: 'Busiest month', value: props.snapshot.insights.busiestMonth ?? 'No pattern yet' },
    { label: 'Prompt source', value: props.snapshot.configurationInsights.promptSourceLabel },
    { label: 'Template', value: props.snapshot.configurationInsights.templateLabel },
]);
</script>

<template>
    <WorkspaceSection title="Insights">
        <dl class="journalyst-review-insights">
            <div v-for="item in items" :key="item.label">
                <dt class="journalyst-type-label">{{ item.label }}</dt>
                <dd class="journalyst-type-row-title" :title="item.value">{{ item.value }}</dd>
            </div>
        </dl>
    </WorkspaceSection>
</template>

<style scoped>
.journalyst-review-insights {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    margin: 0;
    overflow: hidden;
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--journalyst-base-recessed);
}

.journalyst-review-insights div {
    min-width: 0;
    padding: var(--size-4-4);
}

.journalyst-review-insights div + div {
    border-left: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-review-insights dt {
    margin-bottom: var(--size-4-2);
    color: var(--text-faint);
}

.journalyst-review-insights dd {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: var(--text-normal);
    text-overflow: ellipsis;
    white-space: nowrap;
}

@container (max-width: 59rem) {
    .journalyst-review-insights {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .journalyst-review-insights div:nth-child(4) {
        border-left: 0;
    }

    .journalyst-review-insights div:nth-child(n + 4) {
        border-top: var(--border-width) solid var(--background-modifier-border);
    }
}

@container (max-width: 32rem) {
    .journalyst-review-insights {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .journalyst-review-insights div:nth-child(odd) {
        border-left: 0;
    }

    .journalyst-review-insights div:nth-child(n + 3) {
        border-top: var(--border-width) solid var(--background-modifier-border);
    }
}
</style>
