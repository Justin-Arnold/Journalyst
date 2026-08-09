<script setup lang="ts">
import { computed, useId } from "vue";
import type { JournalHomeSummary } from "../../../review/buildHomeSnapshot";
import ObsidianIcon from "../ObsidianIcon.vue";

const props = defineProps<{
    summary: JournalHomeSummary;
    canOpenFirstDue: boolean;
}>();

defineEmits<{
    openFirstDue: [];
}>();

const headingId = useId();

const attentionJournalText = computed(() => {
    const total = props.summary.totalJournals;
    return `${props.summary.attentionJournalCount} of ${total} journal${total === 1 ? '' : 's'}`;
});

const dueTodayTitle = computed(() => {
    const count = props.summary.dueTodayCount;
    return count === 1 ? '1 journal is due today' : `${count} journals are due today`;
});

const catchUpTitle = computed(() => {
    const count = props.summary.catchUpEntryCount;
    return count === 1 ? '1 earlier entry is still open' : `${count} earlier entries are still open`;
});

const hasAttention = computed(() => props.summary.attentionJournalCount > 0);
</script>

<template>
    <section class="journalyst-home-attention" :aria-labelledby="headingId">
        <header class="journalyst-home-attention-header">
            <h2 :id="headingId">Needs attention today</h2>
            <span>{{ attentionJournalText }}</span>
        </header>

        <div class="journalyst-home-attention-list">
            <article v-if="summary.dueTodayCount > 0" class="journalyst-home-attention-row is-due">
                <span class="journalyst-home-attention-icon">
                    <ObsidianIcon name="triangle-alert" />
                </span>
                <div class="journalyst-home-attention-copy">
                    <strong>{{ dueTodayTitle }}</strong>
                    <p>Open today's note or create a new entry to keep your streak going.</p>
                </div>
                <button
                    type="button"
                    class="journalyst-home-attention-action"
                    :disabled="!canOpenFirstDue"
                    @click="$emit('openFirstDue')"
                >
                    <ObsidianIcon name="arrow-right" />
                    <span>Open first</span>
                </button>
            </article>

            <article v-if="summary.catchUpEntryCount > 0" class="journalyst-home-attention-row is-catch-up">
                <span class="journalyst-home-attention-icon">
                    <ObsidianIcon name="history" />
                </span>
                <div class="journalyst-home-attention-copy">
                    <strong>{{ catchUpTitle }}</strong>
                    <p>Catch up when it is useful, or adjust a journal's cadence if its rhythm has changed.</p>
                </div>
            </article>

            <div v-if="!hasAttention" class="journalyst-home-attention-row is-clear" role="status">
                <span class="journalyst-home-attention-icon">
                    <ObsidianIcon name="circle-check" />
                </span>
                <div class="journalyst-home-attention-copy">
                    <strong>Nothing needs attention today</strong>
                    <p>Your scheduled journals are up to date.</p>
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
    display: flex;
    align-items: baseline;
    gap: var(--size-4-3);
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

.journalyst-home-attention-header span {
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
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

.journalyst-home-attention-row.is-due {
    border-left-color: var(--text-warning);
}

.journalyst-home-attention-row.is-catch-up {
    border-left-color: var(--text-muted);
}

.journalyst-home-attention-row.is-clear {
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

.journalyst-home-attention-row.is-due .journalyst-home-attention-icon {
    color: var(--text-warning);
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
    .journalyst-home-attention-header {
        align-items: flex-start;
        flex-direction: column;
        gap: var(--size-4-1);
    }

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
