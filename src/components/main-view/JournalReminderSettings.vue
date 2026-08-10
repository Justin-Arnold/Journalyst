<script setup lang="ts">
import { computed } from 'vue';
import type { JournalAutosaveFeedback, JournalSettingsViewModel } from '../../../journalSettings';
import type { JournalReminderSettings, ReviewReminderPeriod } from '../../../reminders';
import AlertCard from '../AlertCard.vue';
import ObsidianIcon from '../ObsidianIcon.vue';
import JournalAutosaveStatus from './JournalAutosaveStatus.vue';
import ReminderRuleEditor from './ReminderRuleEditor.vue';

const props = defineProps<{
    model: JournalSettingsViewModel;
    autosave: JournalAutosaveFeedback;
}>();

const settings = defineModel<JournalReminderSettings>('settings', { required: true });

const emit = defineEmits<{
    commit: [];
    retry: [];
    undo: [];
    openGlobalReminders: [];
}>();

const reviewPeriods: ReviewReminderPeriod[] = ['weekly', 'monthly', 'quarterly'];
const entryAvailable = computed(() => props.model.cadence.type !== 'adhoc');
const entryStatus = computed(() => {
    if (!entryAvailable.value) return 'Unavailable';
    if (!settings.value.entryReminder.enabled) return 'Off';
    return props.model.remindersEnabled ? 'Active' : 'Global off';
});
const entryStatusClass = computed(() => entryStatus.value.toLowerCase().replace(' ', '-'));
const globalReminderMessage = computed(() => props.model.remindersEnabled
    ? 'Master switch, OS permission, and OS delivery are managed in the main Reminders tab.'
    : 'Global reminders are off. These rules can still be saved, but they will not run.');

function updateSettings(nextSettings: JournalReminderSettings) {
    settings.value = nextSettings;
    emit('commit');
}
</script>

<template>
    <div class="journalyst-journal-reminder-settings">
        <section class="journalyst-journal-reminder-block">
            <header class="journalyst-journal-reminder-header">
                <span class="journalyst-journal-reminder-title">
                    <ObsidianIcon name="bell" />
                    <span>Entry reminder</span>
                </span>
                <span class="journalyst-journal-reminder-status" :class="`is-${entryStatusClass}`">
                    {{ entryStatus }}
                </span>
            </header>

            <ReminderRuleEditor
                v-if="entryAvailable"
                kind="entry"
                :settings="settings"
                @update="updateSettings"
            />
            <AlertCard
                v-else
                class="journalyst-journal-reminder-guidance"
                density="compact"
                icon="calendar-off"
                title="Entry reminders are unavailable"
                description="Ad-hoc journals do not have scheduled entry days. Any saved rule will remain available if this journal receives a schedule later."
            />
        </section>

        <section class="journalyst-journal-reminder-block">
            <header class="journalyst-journal-reminder-header">
                <span class="journalyst-journal-reminder-title">
                    <ObsidianIcon name="sparkles" />
                    <span>Review reminders</span>
                </span>
                <span>Feed the Synthesis tab</span>
            </header>

            <ReminderRuleEditor
                v-for="period in reviewPeriods"
                :key="period"
                :kind="period"
                :settings="settings"
                @update="updateSettings"
            />
        </section>

        <AlertCard
            density="compact"
            :tone="model.remindersEnabled ? 'accent' : 'warning'"
            :icon="model.remindersEnabled ? 'settings-2' : 'circle-alert'"
            :description="globalReminderMessage"
        >
            <template #actions>
                <button type="button" @click="emit('openGlobalReminders')">
                    Open Reminders
                    <ObsidianIcon name="arrow-right" />
                </button>
            </template>
        </AlertCard>

        <JournalAutosaveStatus :feedback="autosave" @retry="emit('retry')" @undo="emit('undo')" />
    </div>
</template>

<style scoped>
.journalyst-journal-reminder-settings,
.journalyst-journal-reminder-block {
    display: flex;
    min-width: 0;
    flex-direction: column;
}

.journalyst-journal-reminder-settings {
    gap: var(--size-4-6);
    container-type: inline-size;
}

.journalyst-journal-reminder-header {
    display: flex;
    min-height: var(--input-height);
    align-items: center;
    justify-content: space-between;
    gap: var(--size-4-3);
    padding-bottom: var(--size-4-2);
    border-bottom: var(--border-width) solid var(--background-modifier-border);
    color: var(--text-muted);
    font-size: var(--font-ui-small);
    flex-wrap: wrap;
}

.journalyst-journal-reminder-title {
    display: flex;
    align-items: center;
}

.journalyst-journal-reminder-title {
    gap: var(--size-4-2);
    text-transform: uppercase;
}

.journalyst-journal-reminder-status {
    padding: var(--size-2-1) var(--size-4-2);
    border-radius: var(--radius-s);
    background: var(--background-modifier-hover);
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
}

.journalyst-journal-reminder-status.is-active {
    color: var(--text-success);
}

.journalyst-journal-reminder-status.is-global-off {
    color: var(--text-warning);
}

.journalyst-journal-reminder-guidance {
    margin-top: var(--size-4-3);
}

button:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
}

@container (max-width: 28rem) {
    .journalyst-journal-reminder-header {
        align-items: flex-start;
        flex-direction: column;
    }

}
</style>
