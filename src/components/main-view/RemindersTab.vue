<script setup lang="ts">
import type { ReminderQuietHoursSettings } from '../../../reminders';
import type { ReminderWorkspaceModel } from './types';
import ReminderGlobalControls from './ReminderGlobalControls.vue';
import ReminderJournalOverview from './ReminderJournalOverview.vue';

defineProps<{
    model: ReminderWorkspaceModel;
}>();

const emit = defineEmits<{
    updateRemindersEnabled: [enabled: boolean];
    updateOsNotificationsEnabled: [enabled: boolean];
    updateQuietHours: [settings: ReminderQuietHoursSettings];
    requestPermission: [];
    testNotification: [];
    editJournal: [journalPath: string];
}>();
</script>

<template>
    <div class="journalyst-reminders-workspace">
        <ReminderGlobalControls
            :model="model"
            @update-reminders-enabled="emit('updateRemindersEnabled', $event)"
            @update-os-notifications-enabled="emit('updateOsNotificationsEnabled', $event)"
            @update-quiet-hours="emit('updateQuietHours', $event)"
            @request-permission="emit('requestPermission')"
            @test-notification="emit('testNotification')"
        />

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
