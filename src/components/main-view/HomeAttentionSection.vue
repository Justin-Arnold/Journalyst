<script setup lang="ts">
import { computed, useId } from "vue";
import type {
    JournalHomeAttentionItem,
    JournalHomeAttentionTarget,
} from "../../../review/buildHomeSnapshot";
import AlertCard from "../AlertCard.vue";
import ObsidianIcon from "../ObsidianIcon.vue";

const props = defineProps<{
    items: JournalHomeAttentionItem[];
}>();

defineEmits<{
    activate: [target: JournalHomeAttentionTarget];
}>();

const headingId = useId();

function getAttentionTone(kind: JournalHomeAttentionItem['kind']): 'accent' | 'error' | 'warning' {
    if (kind === 'streak-at-risk') return 'error';
    if (kind === 'reviews-due') return 'accent';
    return 'warning';
}

const presentedItems = computed(() => props.items.map(item => {
    if (item.kind === 'due-today') {
        return {
            ...item,
            icon: 'triangle-alert',
            title: item.count === 1 ? "1 journal still needs today's entry" : `${item.count} journals still need today's entries`,
            description: "Start today's entry for the next scheduled journal.",
            actionLabel: 'Start first',
        };
    }

    if (item.kind === 'streak-at-risk') {
        return {
            ...item,
            icon: 'flame',
            title: `Your ${item.streakLength}-day streak is at risk`,
            description: item.count === 1
                ? "One scheduled journal still needs today's entry."
                : `${item.count} scheduled journals still need today's entries.`,
            actionLabel: 'Keep it going',
        };
    }

    if (item.kind === 'unfinished-today') {
        return {
            ...item,
            icon: 'file-pen-line',
            title: item.count === 1 ? "1 entry is unfinished today" : `${item.count} entries are unfinished today`,
            description: "Continue writing in today's note to complete the entry.",
            actionLabel: 'Continue first',
        };
    }

    return {
        ...item,
        icon: 'notebook-pen',
        title: item.count === 1 ? '1 synthesis review is due today' : `${item.count} synthesis reviews are due today`,
        description: "Open Synthesis for today's scheduled reflection.",
        actionLabel: 'Open review',
    };
}));
</script>

<template>
    <section class="journalyst-home-attention" :aria-labelledby="headingId">
        <header class="journalyst-home-attention-header">
            <h2 :id="headingId" class="journalyst-type-section-title">Needs attention today</h2>
        </header>

        <div class="journalyst-home-attention-list">
            <AlertCard
                v-for="item in presentedItems"
                :key="item.kind"
                :tone="getAttentionTone(item.kind)"
                :icon="item.icon"
                :title="item.title"
                :description="item.description"
            >
                <template #actions>
                    <button type="button" @click="$emit('activate', item.target)">
                        <ObsidianIcon name="arrow-right" />
                        <span>{{ item.actionLabel }}</span>
                    </button>
                </template>
            </AlertCard>

            <AlertCard
                v-if="items.length === 0"
                tone="success"
                density="compact"
                icon="circle-check"
                title="You're all caught up for today."
                description="No entries or reviews need attention."
                role="status"
            />
        </div>
    </section>
</template>

<style scoped>
.journalyst-home-attention {
    margin-bottom: var(--size-4-8);
}

.journalyst-home-attention-header {
    margin-bottom: var(--size-4-2);
    padding-bottom: var(--size-4-2);
    border-bottom: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-home-attention-header h2 {
    margin: 0;
    color: var(--text-muted);
}

.journalyst-home-attention-list {
    display: grid;
    gap: var(--size-4-3);
}
</style>
