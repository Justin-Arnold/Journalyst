<script setup lang="ts">
import { computed } from 'vue';
import type { ReminderWorkspaceModel } from './types';
import AlertCard from '../AlertCard.vue';
import ObsidianIcon from '../ObsidianIcon.vue';
import ReminderJournalOverview from './ReminderJournalOverview.vue';

const props = defineProps<{
    model: ReminderWorkspaceModel;
}>();

const emit = defineEmits<{
    editJournal: [journalPath: string];
    openSettings: [];
}>();

const globalStatus = computed(() => {
    if (!props.model.remindersEnabled) {
        return {
            tone: 'warning' as const,
            icon: 'bell-off',
            title: 'Global reminders are off',
            description: `${props.model.configuredJournalCount} configured ${props.model.configuredJournalCount === 1 ? 'journal is' : 'journals are'} paused until reminders are enabled in Journalyst settings.`,
        };
    }

    if (
        props.model.osNotificationsEnabled
        && props.model.osPreferredRuleCount > 0
        && props.model.permissionStatus !== 'granted'
    ) {
        return {
            tone: 'warning' as const,
            icon: 'monitor-down',
            title: 'Using in-app fallback',
            description: 'OS-preferred rules will continue as in-app notices until native notification permission is available.',
        };
    }

    const quietHours = props.model.quietHours.enabled
        ? ` Quiet hours run from ${formatTime(props.model.quietHours.startTime)} to ${formatTime(props.model.quietHours.endTime)}.`
        : '';
    return {
        tone: 'success' as const,
        icon: 'bell-ring',
        title: 'Reminders are active',
        description: `${props.model.activeJournalCount} ${props.model.activeJournalCount === 1 ? 'journal has' : 'journals have'} ${props.model.enabledRuleCount} enabled ${props.model.enabledRuleCount === 1 ? 'rule' : 'rules'}.${quietHours}`,
    };
});

function formatTime(value: string) {
    const [hourText, minuteText] = value.split(':');
    const hour = Number.parseInt(hourText, 10);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    return `${hour % 12 || 12}:${minuteText} ${suffix}`;
}
</script>

<template>
    <div class="journalyst-reminders-workspace">
        <AlertCard
            density="compact"
            :tone="globalStatus.tone"
            :icon="globalStatus.icon"
            :title="globalStatus.title"
            :description="globalStatus.description"
        >
            <template #actions>
                <button type="button" @click="emit('openSettings')">
                    <ObsidianIcon name="settings" />
                    Global settings
                </button>
            </template>
        </AlertCard>

        <ReminderJournalOverview
            :journals="model.journals"
            :configured-journal-count="model.configuredJournalCount"
            @edit-journal="emit('editJournal', $event)"
        />
    </div>
</template>

<style scoped>
.journalyst-reminders-workspace {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: var(--size-4-6);
}
</style>
