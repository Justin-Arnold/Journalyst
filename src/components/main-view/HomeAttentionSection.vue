<script setup lang="ts">
import { computed, useId } from "vue";
import type {
    JournalHomeAttentionItem,
    JournalHomeAttentionTarget,
} from "../../../review/buildHomeSnapshot";
import ObsidianIcon from "../ObsidianIcon.vue";

const props = defineProps<{
    items: JournalHomeAttentionItem[];
}>();

defineEmits<{
    activate: [target: JournalHomeAttentionTarget];
}>();

const headingId = useId();

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
            <h2 :id="headingId">Needs attention today</h2>
        </header>

        <div class="journalyst-home-attention-list">
            <article
                v-for="item in presentedItems"
                :key="item.kind"
                class="journalyst-home-attention-row"
                :class="`is-${item.kind}`"
            >
                <span class="journalyst-home-attention-icon">
                    <ObsidianIcon :name="item.icon" />
                </span>
                <div class="journalyst-home-attention-copy">
                    <strong>{{ item.title }}</strong>
                    <p>{{ item.description }}</p>
                </div>
                <button
                    type="button"
                    class="journalyst-home-attention-action"
                    @click="$emit('activate', item.target)"
                >
                    <ObsidianIcon name="arrow-right" />
                    <span>{{ item.actionLabel }}</span>
                </button>
            </article>

            <div v-if="items.length === 0" class="journalyst-home-attention-row is-clear" role="status">
                <span class="journalyst-home-attention-icon">
                    <ObsidianIcon name="circle-check" />
                </span>
                <div class="journalyst-home-attention-copy">
                    <strong>You're all caught up for today.</strong>
                    <p>No entries or reviews need attention.</p>
                </div>
            </div>
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
    font-size: var(--font-ui-small);
    text-transform: uppercase;
    letter-spacing: 0;
}

.journalyst-home-attention-list {
    display: grid;
    gap: var(--size-4-3);
}

.journalyst-home-attention-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--size-4-4);
    min-width: 0;
    padding: var(--size-4-4) var(--size-4-5);
    border: var(--border-width) solid var(--background-modifier-border);
    border-left-width: 3px;
    border-radius: var(--radius-s);
    background: var(--background-secondary);
}

.journalyst-home-attention-row.is-due-today,
.journalyst-home-attention-row.is-unfinished-today {
    border-left-color: var(--text-warning);
}

.journalyst-home-attention-row.is-due-today .journalyst-home-attention-icon,
.journalyst-home-attention-row.is-unfinished-today .journalyst-home-attention-icon {
    color: var(--text-warning);
}

.journalyst-home-attention-row.is-streak-at-risk {
    border-left-color: var(--text-error);
}

.journalyst-home-attention-row.is-streak-at-risk .journalyst-home-attention-icon {
    color: var(--text-error);
}

.journalyst-home-attention-row.is-reviews-due {
    border-left-color: var(--interactive-accent);
}

.journalyst-home-attention-row.is-clear {
    grid-template-columns: auto minmax(0, 1fr);
    padding: var(--size-4-3) var(--size-4-4);
    border-left-color: var(--text-success);
}

.journalyst-home-attention-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: var(--radius-s);
    background: var(--background-modifier-hover);
    color: var(--text-muted);
}

.journalyst-home-attention-row.is-reviews-due .journalyst-home-attention-icon {
    color: var(--text-accent);
}

.journalyst-home-attention-row.is-clear .journalyst-home-attention-icon {
    color: var(--text-success);
}

.journalyst-home-attention-copy {
    min-width: 0;
}

.journalyst-home-attention-copy strong {
    display: block;
    color: var(--text-normal);
    font-size: var(--font-ui-small);
    overflow-wrap: anywhere;
}

.journalyst-home-attention-copy p {
    margin: var(--size-4-1) 0 0;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    overflow-wrap: anywhere;
}

.journalyst-home-attention-action {
    display: inline-flex;
    align-items: center;
    gap: var(--size-4-2);
    min-height: var(--input-height);
    padding: 0 var(--size-4-3);
    border: 0;
    background: transparent;
    box-shadow: none;
    color: var(--text-muted);
    white-space: nowrap;
}

.journalyst-home-attention-action:hover:not(:disabled) {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
}

.journalyst-home-attention-action:focus-visible {
    outline: var(--border-width) solid var(--color-accent);
    outline-offset: var(--size-2-1);
}

@media (max-width: 600px) {
    .journalyst-home-attention-row {
        grid-template-columns: auto minmax(0, 1fr);
        align-items: start;
    }

    .journalyst-home-attention-action {
        grid-column: 2;
        justify-self: start;
    }
}
</style>
