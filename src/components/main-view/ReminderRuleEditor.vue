<script setup lang="ts">
import { computed } from 'vue';
import type {
    JournalReminderSettings,
    ReminderDeliveryMode,
    ReviewReminderPeriod,
} from '../../../reminders';
import ObsidianInput from '../ObsidianInput.vue';
import ObsidianSelect from '../ObsidianSelect.vue';
import ObsidianToggle from '../ObsidianToggle.vue';

type RuleKind = 'entry' | ReviewReminderPeriod;

const props = defineProps<{
    kind: RuleKind;
    settings: JournalReminderSettings;
}>();

const emit = defineEmits<{
    update: [settings: JournalReminderSettings];
}>();

const titles: Record<RuleKind, string> = {
    entry: 'Remind me to write',
    weekly: 'Weekly review',
    monthly: 'Monthly reflection',
    quarterly: 'Quarterly summary',
};

const descriptions: Record<RuleKind, string> = {
    entry: 'Fires when the latest scheduled entry still needs attention.',
    weekly: 'Nudge you to write a weekly synthesis for this journal.',
    monthly: 'Suggest a monthly synthesis on the chosen day.',
    quarterly: 'Prompt a synthesis after each quarter ends.',
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
        return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
            .map((label, value) => ({ label, value: String(value) }));
    }
    if (props.kind === 'monthly') {
        return Array.from({ length: 28 }, (_, index) => ({
            label: getOrdinal(index + 1),
            value: String(index + 1),
        }));
    }
    if (props.kind === 'quarterly') {
        return Array.from({ length: 15 }, (_, index) => ({
            label: index === 0
                ? 'Quarter end'
                : index === 1
                    ? 'Start of next quarter'
                    : `${index} days after`,
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

function getOrdinal(value: number) {
    const remainder = value % 100;
    if (remainder >= 11 && remainder <= 13) return `${value}th`;
    if (value % 10 === 1) return `${value}st`;
    if (value % 10 === 2) return `${value}nd`;
    if (value % 10 === 3) return `${value}rd`;
    return `${value}th`;
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
    <div
        class="journalyst-reminder-rule-row"
        :class="{ 'is-entry': kind === 'entry', 'is-disabled': !currentRule.enabled }"
    >
        <div class="journalyst-reminder-rule-copy">
            <h4>{{ titles[kind] }}</h4>
            <p>{{ descriptions[kind] }}</p>
        </div>
        <div class="journalyst-reminder-rule-fields">
            <label v-if="scheduleLabel" class="journalyst-reminder-field is-schedule">
                <span class="journalyst-visually-hidden">{{ scheduleLabel }}</span>
                <ObsidianSelect
                    :value="scheduleValue"
                    :disabled="!currentRule.enabled"
                    :aria-label="`${titles[kind]} ${scheduleLabel.toLowerCase()}`"
                    @change="updateSchedule(getInputValue($event))"
                >
                    <option v-for="option in scheduleOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                    </option>
                </ObsidianSelect>
            </label>
            <label class="journalyst-reminder-field is-time">
                <span class="journalyst-visually-hidden">Time</span>
                <ObsidianInput
                    type="time"
                    :value="currentRule.time"
                    :disabled="!currentRule.enabled"
                    :aria-label="`${titles[kind]} time`"
                    @change="updateCommon({ time: getInputValue($event) })"
                />
            </label>
            <label class="journalyst-reminder-field is-delivery">
                <span class="journalyst-visually-hidden">Delivery</span>
                <ObsidianSelect
                    :value="currentRule.deliveryMode"
                    :disabled="!currentRule.enabled"
                    :aria-label="`${titles[kind]} delivery`"
                    @change="updateCommon({ deliveryMode: getInputValue($event) as ReminderDeliveryMode })"
                >
                    <option value="in-app">In-app</option>
                    <option value="os-preferred">OS preferred</option>
                </ObsidianSelect>
            </label>
            <ObsidianToggle
                class="journalyst-toggle"
                :model-value="currentRule.enabled"
                :label="`Enable ${titles[kind]}`"
                @update:model-value="updateCommon({ enabled: $event })"
            />
        </div>
    </div>
</template>

<style scoped>
.journalyst-reminder-rule-row {
    display: grid;
    min-width: 0;
    grid-template-columns: minmax(14rem, 1fr) minmax(24rem, 1.3fr);
    align-items: center;
    gap: var(--size-4-5);
    padding: var(--size-4-4) var(--size-4-1);
    border-bottom: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-reminder-rule-copy {
    min-width: 0;
}

.journalyst-reminder-rule-copy h4,
.journalyst-reminder-rule-copy p {
    margin: 0;
}

.journalyst-reminder-rule-copy h4 {
    font-size: var(--journalyst-type-size-card-title);
    font-weight: var(--journalyst-type-weight-row-title);
    line-height: var(--journalyst-type-line-tight);
}

.journalyst-reminder-rule-copy p {
    margin-top: var(--size-4-1);
    color: var(--text-muted);
}

.journalyst-reminder-rule-row.is-disabled .journalyst-reminder-rule-copy h4 {
    color: var(--text-muted);
}

.journalyst-reminder-rule-row.is-disabled .journalyst-reminder-rule-copy p {
    color: var(--text-faint);
}

.journalyst-reminder-rule-fields {
    display: grid;
    width: 100%;
    min-width: 0;
    grid-template-columns: minmax(6.75rem, 1.15fr) minmax(7.25rem, 1fr) minmax(7.5rem, 1.1fr) var(--input-height);
    align-items: center;
    gap: var(--size-4-2);
}

.journalyst-reminder-rule-row.is-entry .journalyst-reminder-rule-fields {
    max-width: 25rem;
    grid-template-columns: minmax(7.25rem, 1fr) minmax(7.5rem, 1.1fr) var(--input-height);
    justify-self: end;
}

.journalyst-reminder-field,
.journalyst-reminder-field select,
.journalyst-reminder-field input {
    min-width: 0;
    width: 100%;
}

.journalyst-toggle {
    display: inline-flex;
    width: var(--input-height);
    height: var(--input-height);
    flex: 0 0 var(--input-height);
    align-items: center;
    justify-content: center;
}

select:focus-visible,
input:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
}

@container (max-width: 44rem) {
    .journalyst-reminder-rule-row {
        grid-template-columns: minmax(0, 1fr);
        gap: var(--size-4-3);
    }

    .journalyst-reminder-rule-row.is-entry .journalyst-reminder-rule-fields {
        width: min(100%, 25rem);
    }
}

@container (max-width: 30rem) {
    .journalyst-reminder-rule-fields {
        grid-template-columns: repeat(2, minmax(0, 1fr)) var(--input-height);
    }

    .journalyst-reminder-rule-row:not(.is-entry) .journalyst-reminder-field.is-schedule {
        grid-column: span 2;
    }

    .journalyst-reminder-rule-row.is-entry .journalyst-reminder-field.is-time {
        grid-column: 1;
    }

    .journalyst-reminder-rule-row.is-entry .journalyst-reminder-rule-fields {
        max-width: none;
        grid-template-columns: repeat(2, minmax(0, 1fr)) var(--input-height);
    }
}

@container (max-width: 23rem) {
    .journalyst-reminder-rule-fields {
        grid-template-columns: minmax(0, 1fr) var(--input-height);
    }

    .journalyst-reminder-rule-row:not(.is-entry) .journalyst-reminder-field.is-schedule,
    .journalyst-reminder-field.is-time,
    .journalyst-reminder-field.is-delivery {
        grid-column: 1;
    }
}
</style>
