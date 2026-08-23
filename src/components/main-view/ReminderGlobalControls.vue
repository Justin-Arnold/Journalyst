<script setup lang="ts">
import { computed } from 'vue';
import type { ReminderQuietHoursSettings } from '../../../reminders';
import type { ReminderWorkspaceModel } from './types';
import ObsidianIcon from '../ObsidianIcon.vue';

const props = defineProps<{
    model: ReminderWorkspaceModel;
}>();

const emit = defineEmits<{
    updateRemindersEnabled: [enabled: boolean];
    updateOsNotificationsEnabled: [enabled: boolean];
    updateQuietHours: [settings: ReminderQuietHoursSettings];
    requestPermission: [];
    testNotification: [];
}>();

const status = computed(() => {
    if (!props.model.remindersEnabled) {
        return { label: 'Off', className: 'is-off' };
    }
    if (
        props.model.osNotificationsEnabled
        && props.model.osPreferredRuleCount > 0
        && props.model.permissionStatus !== 'granted'
    ) {
        return { label: 'In-app fallback', className: 'is-warning' };
    }
    return { label: 'Active', className: 'is-active' };
});

const permissionLabel = computed(() => {
    if (props.model.permissionStatus === 'granted') return 'Granted';
    if (props.model.permissionStatus === 'denied') return 'Denied';
    if (props.model.permissionStatus === 'default') return 'Not requested';
    return 'Unavailable';
});

const permissionDescription = computed(() => {
    if (props.model.permissionStatus === 'granted') {
        return 'Rules set to OS preferred can also send a native notification.';
    }
    if (props.model.permissionStatus === 'denied') {
        return 'Native notifications are denied. Reminders continue as in-app notices.';
    }
    if (props.model.permissionStatus === 'default') {
        return 'Grant permission to allow rules set to OS preferred to send native notifications.';
    }
    return 'Native notifications are unavailable here. Reminders continue in Obsidian.';
});

const quietHoursSummary = computed(() => props.model.quietHours.enabled
    ? props.model.quietHours.startTime === props.model.quietHours.endTime
        ? 'Choose different times'
        : `${formatTime(props.model.quietHours.startTime)} to ${formatTime(props.model.quietHours.endTime)}`
    : 'Off');
const quietHoursInvalid = computed(() => (
    props.model.quietHours.enabled
    && props.model.quietHours.startTime === props.model.quietHours.endTime
));

function getChecked(event: Event) {
    return (event.target as HTMLInputElement).checked;
}

function getValue(event: Event) {
    return (event.target as HTMLInputElement).value;
}

function updateQuietHours(patch: Partial<ReminderQuietHoursSettings>) {
    emit('updateQuietHours', {
        ...props.model.quietHours,
        ...patch,
    });
}

function formatTime(value: string) {
    const [hourText, minuteText] = value.split(':');
    const hour = Number.parseInt(hourText, 10);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minuteText} ${suffix}`;
}
</script>

<template>
    <section class="journalyst-reminder-global-panel" aria-labelledby="journalyst-reminder-global-heading">
        <header class="journalyst-reminder-global-header">
            <span class="journalyst-reminder-global-title">
                <ObsidianIcon name="bell-ring" />
                <span id="journalyst-reminder-global-heading">Global controls</span>
            </span>
            <span class="journalyst-reminder-global-status" :class="status.className">
                {{ status.label }}
            </span>
        </header>

        <div class="journalyst-reminder-global-rows">
            <div class="journalyst-reminder-control-row">
                <div class="journalyst-reminder-control-copy">
                    <strong>Enable reminders</strong>
                    <span>Master switch for entry and synthesis reminders.</span>
                </div>
                <label class="journalyst-toggle" aria-label="Enable reminders">
                    <input
                        type="checkbox"
                        :checked="model.remindersEnabled"
                        @change="emit('updateRemindersEnabled', getChecked($event))"
                    >
                </label>
            </div>

            <div class="journalyst-reminder-control-row">
                <div class="journalyst-reminder-control-copy">
                    <strong>OS notifications</strong>
                    <span>Allow rules set to OS preferred to also use native notifications.</span>
                </div>
                <label class="journalyst-toggle" aria-label="Allow OS notifications">
                    <input
                        type="checkbox"
                        :checked="model.osNotificationsEnabled"
                        @change="emit('updateOsNotificationsEnabled', getChecked($event))"
                    >
                </label>
            </div>

            <div class="journalyst-reminder-control-row">
                <div class="journalyst-reminder-control-copy">
                    <strong>Notification permission</strong>
                    <span>{{ permissionDescription }}</span>
                </div>
                <div class="journalyst-reminder-control-actions">
                    <span class="journalyst-reminder-permission-status">{{ permissionLabel }}</span>
                    <button
                        v-if="model.permissionStatus === 'default'"
                        type="button"
                        @click="emit('requestPermission')"
                    >
                        Request permission
                    </button>
                    <button type="button" @click="emit('testNotification')">
                        <ObsidianIcon name="zap" />
                        Send test
                    </button>
                </div>
            </div>

            <div class="journalyst-reminder-control-row is-quiet-hours">
                <div class="journalyst-reminder-control-copy">
                    <strong>Quiet hours</strong>
                    <span>Hold reminders during this window. Relevant reminders can resume afterward.</span>
                </div>
                <div class="journalyst-reminder-quiet-controls">
                    <span class="journalyst-reminder-quiet-summary">{{ quietHoursSummary }}</span>
                    <input
                        type="time"
                        aria-label="Quiet hours start"
                        :aria-invalid="quietHoursInvalid"
                        :value="model.quietHours.startTime"
                        :disabled="!model.quietHours.enabled"
                        @change="updateQuietHours({ startTime: getValue($event) })"
                    >
                    <ObsidianIcon name="arrow-right" />
                    <input
                        type="time"
                        aria-label="Quiet hours end"
                        :aria-invalid="quietHoursInvalid"
                        :value="model.quietHours.endTime"
                        :disabled="!model.quietHours.enabled"
                        @change="updateQuietHours({ endTime: getValue($event) })"
                    >
                    <label class="journalyst-toggle" aria-label="Enable quiet hours">
                        <input
                            type="checkbox"
                            :checked="model.quietHours.enabled"
                            @change="updateQuietHours({ enabled: getChecked($event) })"
                        >
                    </label>
                    <span v-if="quietHoursInvalid" class="journalyst-reminder-quiet-error">
                        Start and end must differ.
                    </span>
                </div>
            </div>
        </div>

        <div class="journalyst-reminder-global-summary" aria-label="Reminder summary">
            <span>
                <strong>{{ model.activeJournalCount }}</strong>
                active journal{{ model.activeJournalCount === 1 ? '' : 's' }}
            </span>
            <span>
                <strong>{{ model.enabledRuleCount }}</strong>
                enabled rule{{ model.enabledRuleCount === 1 ? '' : 's' }}
            </span>
            <span>
                <strong>{{ model.osPreferredRuleCount }}</strong>
                OS preferred
            </span>
        </div>
    </section>
</template>

<style scoped>
.journalyst-reminder-global-panel {
    overflow: hidden;
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--journalyst-base-recessed);
    container-type: inline-size;
}

.journalyst-reminder-global-header,
.journalyst-reminder-global-title,
.journalyst-reminder-control-row,
.journalyst-reminder-control-actions,
.journalyst-reminder-quiet-controls,
.journalyst-reminder-global-summary,
.journalyst-reminder-global-summary span {
    display: flex;
    align-items: center;
}

.journalyst-reminder-global-header {
    min-height: var(--input-height);
    justify-content: space-between;
    gap: var(--size-4-3);
    padding: var(--size-4-3) var(--size-4-4);
    border-bottom: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-reminder-global-title {
    gap: var(--size-4-2);
    color: var(--text-muted);
    font-size: var(--font-ui-small);
    text-transform: uppercase;
}

.journalyst-reminder-global-status,
.journalyst-reminder-permission-status,
.journalyst-reminder-quiet-summary {
    padding: var(--size-2-1) var(--size-4-2);
    border-radius: var(--radius-s);
    background: var(--background-modifier-hover);
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    white-space: nowrap;
}

.journalyst-reminder-global-status.is-active {
    color: var(--text-success);
}

.journalyst-reminder-global-status.is-warning {
    color: var(--text-warning);
}

.journalyst-reminder-control-row {
    min-width: 0;
    justify-content: space-between;
    gap: var(--size-4-5);
    padding: var(--size-4-4);
}

.journalyst-reminder-control-row + .journalyst-reminder-control-row {
    border-top: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-reminder-control-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: var(--size-4-1);
}

.journalyst-reminder-control-copy strong {
    color: var(--text-normal);
    font-size: var(--font-ui-small);
}

.journalyst-reminder-control-copy span {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    line-height: 1.4;
}

.journalyst-reminder-control-actions,
.journalyst-reminder-quiet-controls {
    min-width: 0;
    justify-content: flex-end;
    gap: var(--size-4-2);
}

.journalyst-reminder-control-actions button {
    display: inline-flex;
    width: auto;
    align-items: center;
    gap: var(--size-4-2);
}

.journalyst-reminder-quiet-controls input[type='time'] {
    width: 8rem;
}

.journalyst-reminder-quiet-summary {
    display: none;
}

.journalyst-reminder-quiet-error {
    flex-basis: 100%;
    color: var(--text-error);
    font-size: var(--font-ui-smaller);
    text-align: right;
}

.journalyst-reminder-global-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    border-top: var(--border-width) solid var(--background-modifier-border);
    background: var(--background-primary-alt, var(--background-primary));
}

.journalyst-reminder-global-summary span {
    min-width: 0;
    justify-content: center;
    gap: var(--size-4-2);
    padding: var(--size-4-3);
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    text-align: center;
}

.journalyst-reminder-global-summary span + span {
    border-left: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-reminder-global-summary strong {
    color: var(--text-normal);
}

button:focus-visible,
input:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
}

@container (max-width: 46rem) {
    .journalyst-reminder-control-row {
        align-items: flex-start;
        flex-direction: column;
        gap: var(--size-4-3);
    }

    .journalyst-reminder-control-row > .journalyst-toggle {
        align-self: flex-start;
    }

    .journalyst-reminder-control-actions,
    .journalyst-reminder-quiet-controls {
        justify-content: flex-start;
        flex-wrap: wrap;
    }
}

@container (max-width: 30rem) {
    .journalyst-reminder-quiet-controls {
        display: grid;
        width: 100%;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) var(--input-height);
    }

    .journalyst-reminder-quiet-controls input[type='time'] {
        width: 100%;
        min-width: 0;
    }

    .journalyst-reminder-quiet-summary {
        display: inline-flex;
        grid-column: 1 / -1;
        justify-self: start;
    }

    .journalyst-reminder-quiet-error {
        grid-column: 1 / -1;
        text-align: left;
    }

    .journalyst-reminder-global-summary {
        grid-template-columns: 1fr;
    }

    .journalyst-reminder-global-summary span + span {
        border-top: var(--border-width) solid var(--background-modifier-border);
        border-left: 0;
    }
}
</style>
