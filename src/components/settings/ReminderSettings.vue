<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { ReminderQuietHoursSettings } from '../../../reminders';
import AlertCard from '../AlertCard.vue';
import ObsidianIcon from '../ObsidianIcon.vue';
import ObsidianButton from './ObsidianButton.vue';
import ObsidianToggle from './ObsidianToggle.vue';
import SettingsGroup from './SettingsGroup.vue';
import SettingsRow from './SettingsRow.vue';
import type { JournalystSettingsActions, ReminderSettingsModel } from './types';
import { useSettingsAction } from './useSettingsAction';

const props = defineProps<{
    model: ReminderSettingsModel;
    actions: JournalystSettingsActions;
}>();

const enabled = ref(props.model.enabled);
const osNotificationsEnabled = ref(props.model.osNotificationsEnabled);
const quietHours = reactive<ReminderQuietHoursSettings>({ ...props.model.quietHours });
const validationError = ref('');
const { error, run, isPending } = useSettingsAction();

const permissionLabel = computed(() => ({
    granted: 'Allowed',
    denied: 'Denied',
    default: 'Not requested',
    unsupported: 'Unavailable',
}[props.model.permissionStatus]));

watch(() => props.model, model => {
    enabled.value = model.enabled;
    osNotificationsEnabled.value = model.osNotificationsEnabled;
    Object.assign(quietHours, model.quietHours);
});

async function updateEnabled(value: boolean) {
    const previous = props.model.enabled;
    enabled.value = value;
    const saved = await run('enabled', () => props.actions.updateRemindersEnabled(value));
    if (!saved) enabled.value = previous;
}

async function updateOsNotifications(value: boolean) {
    const previous = props.model.osNotificationsEnabled;
    osNotificationsEnabled.value = value;
    const saved = await run('os', () => props.actions.updateOsNotificationsEnabled(value));
    if (!saved) osNotificationsEnabled.value = previous;
}

async function saveQuietHours(next: ReminderQuietHoursSettings) {
    validationError.value = '';
    if (next.enabled && (!next.startTime || !next.endTime)) {
        validationError.value = 'Choose both a start and end time for quiet hours.';
        return;
    }
    if (next.enabled && next.startTime === next.endTime) {
        validationError.value = 'Quiet hours must start and end at different times.';
        return;
    }

    const previous = { ...props.model.quietHours };
    Object.assign(quietHours, next);
    const saved = await run('quiet', () => props.actions.updateQuietHours({ ...next }));
    if (!saved) Object.assign(quietHours, previous);
}

function updateQuietTime(key: 'startTime' | 'endTime', event: Event) {
    const value = (event.target as HTMLInputElement).value;
    void saveQuietHours({ ...quietHours, [key]: value });
}
</script>

<template>
    <SettingsGroup
        title="Reminders"
        description="Manage the global reminder switch, system notifications, testing, and quiet hours."
        icon="bell"
        :status="model.enabled ? 'Active' : 'Off'"
        :status-tone="model.enabled ? 'success' : 'neutral'"
    >
        <AlertCard
            v-if="error || validationError"
            class="journalyst-settings-guidance"
            tone="error"
            density="compact"
            icon="circle-alert"
            title="Reminder setting could not be saved"
            :description="validationError || error"
            role="alert"
        />

        <AlertCard
            v-else-if="model.permissionStatus === 'denied'"
            class="journalyst-settings-guidance"
            tone="warning"
            density="compact"
            icon="bell-off"
            title="System notifications are blocked"
            description="Journalyst can still deliver in-app reminders. Allow notifications for Obsidian in your system settings to use native alerts."
        />

        <AlertCard
            v-else-if="model.permissionStatus === 'unsupported'"
            class="journalyst-settings-guidance"
            tone="neutral"
            density="compact"
            icon="info"
            title="System notifications are unavailable"
            description="This Obsidian environment does not expose native notifications, so Journalyst will use in-app reminders."
        />

        <SettingsRow
            title="Enable reminders"
            description="Master switch for every entry and synthesis reminder. Saved journal rules remain intact while this is off."
        >
            <ObsidianToggle
                :model-value="enabled"
                :disabled="isPending('enabled')"
                label="Enable Journalyst reminders"
                @update:model-value="updateEnabled"
            />
        </SettingsRow>

        <SettingsRow
            title="OS notifications"
            description="Prefer native system notifications when a reminder rule allows them."
        >
            <span class="journalyst-settings-inline-status">{{ permissionLabel }}</span>
            <ObsidianButton
                v-if="model.permissionStatus === 'default'"
                variant="cta"
                :disabled="isPending('permission')"
                @click="run('permission', actions.requestNotificationPermission)"
            >
                Allow
            </ObsidianButton>
            <ObsidianToggle
                :model-value="osNotificationsEnabled"
                :disabled="isPending('os') || model.permissionStatus === 'unsupported'"
                label="Prefer OS notifications"
                @update:model-value="updateOsNotifications"
            />
        </SettingsRow>

        <SettingsRow
            title="Test notification"
            description="Send a sample reminder using the current delivery preference."
        >
            <ObsidianButton
                variant="cta"
                :disabled="isPending('test')"
                @click="run('test', actions.sendTestNotification)"
            >
                <ObsidianIcon name="zap" />
                Send test
            </ObsidianButton>
        </SettingsRow>

        <SettingsRow
            title="Quiet hours"
            description="Suppress entry and synthesis reminders during this daily time range. Overnight ranges are supported."
        >
            <div class="journalyst-settings-time-range">
                <input
                    v-model="quietHours.startTime"
                    type="time"
                    aria-label="Quiet hours start"
                    :disabled="isPending('quiet') || !quietHours.enabled"
                    @change="updateQuietTime('startTime', $event)"
                >
                <ObsidianIcon name="arrow-right" />
                <input
                    v-model="quietHours.endTime"
                    type="time"
                    aria-label="Quiet hours end"
                    :disabled="isPending('quiet') || !quietHours.enabled"
                    @change="updateQuietTime('endTime', $event)"
                >
            </div>
            <ObsidianToggle
                :model-value="quietHours.enabled"
                :disabled="isPending('quiet')"
                label="Enable quiet hours"
                @update:model-value="value => saveQuietHours({ ...quietHours, enabled: value })"
            />
        </SettingsRow>
    </SettingsGroup>
</template>

<style scoped>
.journalyst-settings-guidance {
    margin: var(--size-4-4);
}

.journalyst-settings-inline-status {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
}

.journalyst-settings-time-range {
    display: inline-flex;
    align-items: center;
    gap: var(--size-4-2);
}

.journalyst-settings-time-range input {
    width: 8rem;
}

.journalyst-settings-time-range :deep(.journalyst-icon) {
    color: var(--text-faint);
}
</style>
