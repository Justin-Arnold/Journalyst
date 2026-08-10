<script setup lang="ts">
import type { JournalAutosaveFeedback } from '../../../journalSettings';
import ObsidianIcon from '../ObsidianIcon.vue';

defineProps<{
    feedback: JournalAutosaveFeedback;
}>();

defineEmits<{
    retry: [];
    undo: [];
}>();

const statusIcons: Record<JournalAutosaveFeedback['status'], string> = {
    idle: 'cloud',
    saving: 'loader-circle',
    saved: 'check',
    error: 'circle-alert',
    invalid: 'triangle-alert',
};
</script>

<template>
    <footer
        class="journalyst-autosave-status"
        :class="`is-${feedback.status}`"
        :role="feedback.status === 'error' ? 'alert' : 'status'"
        aria-live="polite"
    >
        <span class="journalyst-autosave-message">
            <ObsidianIcon
                :name="statusIcons[feedback.status]"
                :class="{ 'is-spinning': feedback.status === 'saving' }"
            />
            <span>{{ feedback.message }}</span>
        </span>
        <span v-if="feedback.canRetry || feedback.canUndo" class="journalyst-autosave-actions">
            <button v-if="feedback.canRetry" type="button" @click="$emit('retry')">Retry</button>
            <button v-if="feedback.canUndo" type="button" @click="$emit('undo')">
                <ObsidianIcon name="undo-2" />
                Undo
            </button>
        </span>
    </footer>
</template>

<style scoped>
.journalyst-autosave-status,
.journalyst-autosave-message,
.journalyst-autosave-actions,
.journalyst-autosave-actions button {
    display: flex;
    align-items: center;
}

.journalyst-autosave-status {
    min-height: var(--input-height);
    justify-content: flex-end;
    gap: var(--size-4-3);
    padding-top: var(--size-4-3);
    color: var(--text-muted);
    font-size: var(--font-ui-small);
    flex-wrap: wrap;
}

.journalyst-autosave-status.is-error,
.journalyst-autosave-status.is-invalid {
    color: var(--text-error);
}

.journalyst-autosave-status.is-saved {
    color: var(--text-success);
}

.journalyst-autosave-message,
.journalyst-autosave-actions,
.journalyst-autosave-actions button {
    gap: var(--size-4-1);
}

.journalyst-autosave-actions button {
    width: auto;
    min-height: var(--input-height);
    justify-content: center;
}

.is-spinning {
    animation: journalyst-autosave-spin 0.8s linear infinite;
}

button:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
}

@keyframes journalyst-autosave-spin {
    to {
        transform: rotate(360deg);
    }
}

@container (max-width: 24rem) {
    .journalyst-autosave-status {
        align-items: stretch;
        flex-direction: column;
    }

    .journalyst-autosave-actions button {
        flex: 1 1 auto;
    }
}
</style>
