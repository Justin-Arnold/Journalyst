<script setup lang="ts">
import type { AnalyticsInsight } from '../../../review/types';
import AlertCard from '../AlertCard.vue';

defineProps<{
    insights: AnalyticsInsight[];
}>();
</script>

<template>
    <section class="journalyst-analytics-insights" aria-label="Analytics insights">
        <AlertCard
            v-for="insight in insights"
            :key="insight.id"
            :tone="insight.tone"
            :icon="insight.icon"
            :title="insight.title"
            :description="insight.description"
        />
    </section>
</template>

<style scoped>
.journalyst-analytics-insights {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--size-4-4);
    margin-bottom: var(--size-4-6);
}

.journalyst-analytics-insights > :only-child {
    grid-column: 1 / -1;
}

@container (max-width: 44rem) {
    .journalyst-analytics-insights {
        grid-template-columns: 1fr;
    }

    .journalyst-analytics-insights > :only-child {
        grid-column: auto;
    }
}
</style>
