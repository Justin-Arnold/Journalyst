<script setup lang="ts">
import type { JournalAutosaveFeedback } from '../../../journalSettings';
import AlertCard from '../AlertCard.vue';
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

const statusTones: Record<JournalAutosaveFeedback['status'], 'neutral' | 'accent' | 'success' | 'warning' | 'error'> = {
    idle: 'neutral',
    saving: 'accent',
    saved: 'success',
    error: 'error',
    invalid: 'warning',
};
</script>

<template>
    <AlertCard
        class="journalyst-autosave-status"
        density="compact"
        :tone="statusTones[feedback.status]"
        :icon="statusIcons[feedback.status]"
        :icon-class="feedback.status === 'saving' ? 'is-spinning' : ''"
        :title="feedback.message"
        :role="feedback.status === 'error' ? 'alert' : 'status'"
        aria-live="polite"
    >
        <template v-if="feedback.canRetry || feedback.canUndo" #actions>
            <button v-if="feedback.canRetry" type="button" @click="$emit('retry')">Retry</button>
            <button v-if="feedback.canUndo" type="button" @click="$emit('undo')">
                <ObsidianIcon name="undo-2" />
                Undo
            </button>
        </template>
    </AlertCard>
</template>

<style scoped>
.journalyst-autosave-status {
    margin-top: var(--size-4-3);
}

.journalyst-autosave-status :deep(.is-spinning) {
    animation: journalyst-autosave-spin 0.8s linear infinite;
}

@keyframes journalyst-autosave-spin {
    to {
        transform: rotate(360deg);
    }
}

</style>
