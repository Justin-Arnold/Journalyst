<script setup lang="ts">
import { computed } from "vue";
import type {
    JournalReminderSettings,
    ReminderDeliveryMode,
    ReviewReminderPeriod,
} from "../../../reminders";

type RuleKind = 'entry' | ReviewReminderPeriod;

const props = defineProps<{
    kind: RuleKind;
    settings: JournalReminderSettings;
}>();

const emit = defineEmits<{
    update: [settings: JournalReminderSettings];
}>();

const titles: Record<RuleKind, string> = {
    entry: 'Entry reminder',
    weekly: 'Weekly review',
    monthly: 'Monthly reflection',
    quarterly: 'Quarter summary',
};

const descriptions: Record<RuleKind, string> = {
    entry: 'Nudge once when a scheduled entry is due and still missing.',
    weekly: 'Prompt a weekly synthesis pass for this journal.',
    monthly: 'Prompt a monthly reflection for this journal.',
    quarterly: 'Prompt a summary after each quarter ends.',
};

const currentRule = computed(() => props.kind === 'entry'
    ? props.settings.entryReminder
    : props.settings.reviewReminders[props.kind]);

const scheduleLabel = computed(() => {
    if (props.kind === 'weekly') return 'Weekday';
    if (props.kind === 'monthly') return 'Day';
    if (props.kind === 'quarterly') return 'Offset';
    return null;
});

const scheduleOptions = computed(() => {
    if (props.kind === 'weekly') {
        return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
            .map((label, value) => ({ label, value: String(value) }));
    }
    if (props.kind === 'monthly') {
        return Array.from({ length: 28 }, (_, index) => ({
            label: `Day ${index + 1}`,
            value: String(index + 1),
        }));
    }
    if (props.kind === 'quarterly') {
        return Array.from({ length: 15 }, (_, index) => ({
            label: index === 0 ? 'Quarter end' : `${index} day${index === 1 ? '' : 's'} after`,
            value: String(index),
        }));
    }
    return [];
});

const scheduleValue = computed(() => {
    if (props.kind === 'weekly') return String(props.settings.reviewReminders.weekly.weekday);
    if (props.kind === 'monthly') return String(props.settings.reviewReminders.monthly.dayOfMonth);
    if (props.kind === 'quarterly') return String(props.settings.reviewReminders.quarterly.daysAfterQuarterEnd);
    return '';
});

function getInputValue(event: Event) {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
}

function getChecked(event: Event) {
    return (event.target as HTMLInputElement).checked;
}

function updateCommon(patch: { enabled?: boolean; time?: string; deliveryMode?: ReminderDeliveryMode }) {
    if (props.kind === 'entry') {
        emit('update', {
            ...props.settings,
            entryReminder: {
                ...props.settings.entryReminder,
                ...patch,
            },
        });
        return;
    }

    emit('update', {
        ...props.settings,
        reviewReminders: {
            ...props.settings.reviewReminders,
            [props.kind]: {
                ...props.settings.reviewReminders[props.kind],
                ...patch,
            },
        },
    });
}

function updateSchedule(value: string) {
    const numericValue = Number.parseInt(value, 10);
    if (props.kind === 'weekly') {
        emit('update', {
            ...props.settings,
            reviewReminders: {
                ...props.settings.reviewReminders,
                weekly: { ...props.settings.reviewReminders.weekly, weekday: numericValue },
            },
        });
    } else if (props.kind === 'monthly') {
        emit('update', {
            ...props.settings,
            reviewReminders: {
                ...props.settings.reviewReminders,
                monthly: { ...props.settings.reviewReminders.monthly, dayOfMonth: numericValue },
            },
        });
    } else if (props.kind === 'quarterly') {
        emit('update', {
            ...props.settings,
            reviewReminders: {
                ...props.settings.reviewReminders,
                quarterly: { ...props.settings.reviewReminders.quarterly, daysAfterQuarterEnd: numericValue },
            },
        });
    }
}
</script>

<template>
    <div class="journalyst-reminder-rule-row">
        <div class="journalyst-reminder-rule-copy">
            <div class="journalyst-reminder-inline-row">
                <div>
                    <h4>{{ titles[kind] }}</h4>
                    <p class="journalyst-review-empty-text">{{ descriptions[kind] }}</p>
                </div>
                <label class="journalyst-toggle" :aria-label="`Enable ${titles[kind]}`">
                    <input
                        type="checkbox"
                        :checked="currentRule.enabled"
                        @change="updateCommon({ enabled: getChecked($event) })"
                    >
                </label>
            </div>
        </div>
        <div class="journalyst-reminder-rule-fields">
            <label class="journalyst-reminder-field">
                <span>Time</span>
                <input
                    type="time"
                    :value="currentRule.time"
                    :disabled="!currentRule.enabled"
                    @change="updateCommon({ time: getInputValue($event) })"
                >
            </label>
            <label class="journalyst-reminder-field">
                <span>Delivery</span>
                <select
                    :value="currentRule.deliveryMode"
                    :disabled="!currentRule.enabled"
                    @change="updateCommon({ deliveryMode: getInputValue($event) as ReminderDeliveryMode })"
                >
                    <option value="in-app">In-app</option>
                    <option value="os-preferred">OS preferred</option>
                </select>
            </label>
            <label v-if="scheduleLabel" class="journalyst-reminder-field">
                <span>{{ scheduleLabel }}</span>
                <select
                    :value="scheduleValue"
                    :disabled="!currentRule.enabled"
                    @change="updateSchedule(getInputValue($event))"
                >
                    <option v-for="option in scheduleOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                    </option>
                </select>
            </label>
        </div>
    </div>
</template>
