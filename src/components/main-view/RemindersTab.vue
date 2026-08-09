<script setup lang="ts">
import { computed } from "vue";
import type { ReminderWorkspaceModel } from "./types";
import ObsidianIcon from "../ObsidianIcon.vue";
import WorkspaceOverview from "./WorkspaceOverview.vue";
import WorkspaceSection from "./WorkspaceSection.vue";

const props = defineProps<{
    model: ReminderWorkspaceModel;
}>();

const emit = defineEmits<{
    updateRemindersEnabled: [enabled: boolean];
    updateOsNotificationsEnabled: [enabled: boolean];
    requestPermission: [];
    testNotification: [];
    editJournal: [journalPath: string];
}>();

const permissionLabel = computed(() => {
    if (props.model.permissionStatus === 'granted') return 'Granted';
    if (props.model.permissionStatus === 'denied') return 'Denied';
    if (props.model.permissionStatus === 'default') return 'Not asked';
    return 'Unavailable';
});

const permissionText = computed(() => {
    if (props.model.permissionStatus === 'granted') return 'OS notifications are available.';
    if (props.model.permissionStatus === 'denied') return 'OS notifications are denied, so Journalyst will fall back to in-app notices.';
    if (props.model.permissionStatus === 'default') return 'OS notifications are not granted yet. You can request permission below.';
    return 'OS notifications are not available in this environment. Journalyst will use in-app notices.';
});

const stats = computed(() => [
    { label: 'Global', value: props.model.remindersEnabled ? 'On' : 'Off' },
    { label: 'Permission', value: permissionLabel.value },
    { label: 'Journals active', value: `${props.model.activeJournalCount}` },
    { label: 'Delivery', value: props.model.osNotificationsEnabled ? 'OS preferred' : 'In-app' },
]);

function getChecked(event: Event) {
    return (event.target as HTMLInputElement).checked;
}
</script>

<template>
    <WorkspaceOverview
        title="Reminders"
        description="Configure entry and reflection nudges while Obsidian is running."
        :stats="stats"
    />

    <WorkspaceSection
        title="Global reminder settings"
        description="Use OS delivery when available; Journalyst falls back to in-app notices."
    >
        <div class="journalyst-reminder-global-list">
            <div class="journalyst-reminder-global-row">
                <div>
                    <h3>Enable reminders</h3>
                    <p class="journalyst-review-empty-text">{{ permissionText }}</p>
                </div>
                <label class="journalyst-toggle" aria-label="Enable reminders">
                    <input
                        type="checkbox"
                        :checked="model.remindersEnabled"
                        @change="emit('updateRemindersEnabled', getChecked($event))"
                    >
                </label>
            </div>
            <div class="journalyst-reminder-global-row">
                <div>
                    <h3>Prefer OS notifications</h3>
                    <p class="journalyst-review-empty-text">When enabled and permitted, Journalyst also uses operating-system notifications.</p>
                </div>
                <label class="journalyst-toggle" aria-label="Prefer OS notifications">
                    <input
                        type="checkbox"
                        :checked="model.osNotificationsEnabled"
                        :disabled="!model.remindersEnabled"
                        @change="emit('updateOsNotificationsEnabled', getChecked($event))"
                    >
                </label>
            </div>
            <div class="journalyst-reminder-global-row journalyst-reminder-permission-row">
                <div>
                    <h3>Permission and testing</h3>
                    <p class="journalyst-review-empty-text">{{ permissionText }}</p>
                </div>
                <div class="journal-section-actions">
                    <button
                        type="button"
                        class="journal-section-button"
                        :disabled="model.permissionStatus === 'granted' || model.permissionStatus === 'unsupported'"
                        @click="emit('requestPermission')"
                    >
                        Request permission
                    </button>
                    <button
                        type="button"
                        class="journal-section-button"
                        :disabled="!model.remindersEnabled"
                        @click="emit('testNotification')"
                    >
                        Test notification
                    </button>
                </div>
            </div>
        </div>
    </WorkspaceSection>

    <WorkspaceSection
        title="Journal reminder rules"
        description="See which journals have active rules and open the journal editor to make changes."
    >
        <div class="journalyst-reminder-journal-list">
            <article v-for="journal in model.journals" :key="journal.journalPath" class="journalyst-reminder-journal-card">
                <header class="journalyst-reminder-journal-header">
                    <div>
                        <h3>{{ journal.journalName }}</h3>
                        <p class="journalyst-review-meta">
                            {{ journal.cadenceLabel }} · {{ journal.cadenceType === 'adhoc' ? 'Entry reminders unavailable' : 'Entry reminders supported' }}
                        </p>
                    </div>
                    <span class="journalyst-home-status-badge">{{ journal.reminderSummary }}</span>
                </header>

                <div class="journalyst-reminder-summary-row">
                    <span>{{ journal.entryReminderEnabled && journal.cadenceType !== 'adhoc' ? 'Entry reminder on' : 'Entry reminder off' }}</span>
                    <span>{{ journal.reviewReminderCount }} review rule{{ journal.reviewReminderCount === 1 ? '' : 's' }}</span>
                    <button
                        type="button"
                        class="journal-section-button"
                        @click="emit('editJournal', journal.journalPath)"
                    >
                        Edit
                        <ObsidianIcon name="arrow-right" />
                    </button>
                </div>
            </article>
        </div>
    </WorkspaceSection>
</template>

<style scoped>
.journalyst-reminder-summary-row {
    display: flex;
    align-items: center;
    gap: var(--size-4-4);
    padding-top: var(--size-4-3);
    color: var(--text-muted);
    border-top: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-reminder-summary-row button {
    display: inline-flex;
    align-items: center;
    gap: var(--size-4-1);
    margin-left: auto;
}

@media (max-width: 520px) {
    .journalyst-reminder-summary-row {
        align-items: flex-start;
        flex-direction: column;
        gap: var(--size-4-2);
    }

    .journalyst-reminder-summary-row button {
        margin-left: 0;
    }
}
</style>
