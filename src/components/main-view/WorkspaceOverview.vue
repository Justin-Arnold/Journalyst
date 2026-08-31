<script setup lang="ts">
export interface OverviewStat {
    label: string;
    value: string;
}

export interface OverviewAction {
    id: string;
    label: string;
}

defineProps<{
    title: string;
    description: string;
    stats: OverviewStat[];
    actions?: OverviewAction[];
}>();

defineEmits<{
    action: [actionId: string];
}>();
</script>

<template>
    <section class="journalyst-review-overview">
        <div class="journalyst-review-overview-copy">
            <h2 class="journalyst-type-section-title">{{ title }}</h2>
            <p class="journalyst-review-section-description journalyst-type-supporting">{{ description }}</p>
            <div v-if="actions?.length" class="journalyst-review-overview-actions">
                <button
                    v-for="action in actions"
                    :key="action.id"
                    type="button"
                    class="journal-section-button"
                    @click="$emit('action', action.id)"
                >
                    {{ action.label }}
                </button>
            </div>
        </div>
        <dl class="journalyst-review-overview-stats">
            <div v-for="stat in stats" :key="stat.label" class="journalyst-review-stat">
                <dt class="journalyst-review-label journalyst-type-label">{{ stat.label }}</dt>
                <dd class="journalyst-type-metric-medium">{{ stat.value }}</dd>
            </div>
        </dl>
    </section>
</template>
