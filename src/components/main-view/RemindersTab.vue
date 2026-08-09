<script setup lang="ts">
import { computed } from "vue";
import type { JournalReminderSettings } from "../../../reminders";
import type { ReminderWorkspaceModel } from "./types";
import ReminderRuleEditor from "./ReminderRuleEditor.vue";
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
    updateJournalSettings: [journalPath: string, settings: JournalReminderSettings];
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
        description="Configure due-entry and reflection reminders for each journal."
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

                <div class="journalyst-reminder-rules">
                    <ReminderRuleEditor
                        v-if="journal.cadenceType !== 'adhoc'"
                        kind="entry"
                        :settings="journal.settings"
                        @update="emit('updateJournalSettings', journal.journalPath, $event)"
                    />
                    <div v-else class="journalyst-reminder-rule-row is-muted">
                        <div class="journalyst-reminder-rule-copy">
                            <h4>Entry reminder</h4>
                            <p class="journalyst-review-empty-text">
                                Ad hoc journals do not use due-entry reminders because they are intentionally not tracked on a schedule.
                            </p>
                        </div>
                    </div>
                    <ReminderRuleEditor
                        v-for="period in (['weekly', 'monthly', 'quarterly'] as const)"
                        :key="period"
                        :kind="period"
                        :settings="journal.settings"
                        @update="emit('updateJournalSettings', journal.journalPath, $event)"
                    />
                </div>
            </article>
        </div>
    </WorkspaceSection>
</template>
