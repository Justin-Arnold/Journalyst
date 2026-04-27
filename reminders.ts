import moment from 'moment';
import { isCadenceTracked, type JournalCadenceConfig, getExpectedDatesInRange, getNextExpectedDate } from './cadence';
import { type SynthesisPeriodType } from './review/types';

export type ReminderDeliveryMode = 'in-app' | 'os-preferred';
export type ReviewReminderPeriod = 'weekly' | 'monthly' | 'quarterly';

export interface JournalEntryReminderSettings {
    enabled: boolean;
    time: string;
    deliveryMode: ReminderDeliveryMode;
}

export interface WeeklyReviewReminderSettings {
    enabled: boolean;
    time: string;
    deliveryMode: ReminderDeliveryMode;
    weekday: number;
}

export interface MonthlyReviewReminderSettings {
    enabled: boolean;
    time: string;
    deliveryMode: ReminderDeliveryMode;
    dayOfMonth: number;
}

export interface QuarterlyReviewReminderSettings {
    enabled: boolean;
    time: string;
    deliveryMode: ReminderDeliveryMode;
    daysAfterQuarterEnd: number;
}

export interface JournalReviewReminderSettings {
    weekly: WeeklyReviewReminderSettings;
    monthly: MonthlyReviewReminderSettings;
    quarterly: QuarterlyReviewReminderSettings;
}

export interface JournalReminderSettings {
    entryReminder: JournalEntryReminderSettings;
    reviewReminders: JournalReviewReminderSettings;
}

export interface ReminderOccurrenceRecord {
    journalPath: string;
    ruleKey: string;
    occurrenceKey: string;
    sentAt: string;
}

export interface ReminderTarget {
    type: 'entry' | 'review';
    anchorDate: string;
    reviewPeriod?: ReviewReminderPeriod;
}

export interface ResolvedReminderEvent {
    historyKey: string;
    journalPath: string;
    journalName: string;
    deliveryMode: ReminderDeliveryMode;
    title: string;
    message: string;
    target: ReminderTarget;
}

export interface JournalReminderContext {
    cadence: JournalCadenceConfig;
    dateSet: Set<string>;
    journalName: string;
    journalPath: string;
    reminderSettings: JournalReminderSettings;
    synthesisNoteExists: (period: ReviewReminderPeriod, anchorDate: string) => boolean;
}

const DEFAULT_TIME = '20:00';
const DEFAULT_REVIEW_TIME = '18:00';
const MAX_EXPECTATION_SCAN_DAYS = 730;

const DEFAULT_REMINDER_SETTINGS: JournalReminderSettings = {
    entryReminder: {
        enabled: false,
        time: DEFAULT_TIME,
        deliveryMode: 'in-app',
    },
    reviewReminders: {
        weekly: {
            enabled: false,
            time: DEFAULT_REVIEW_TIME,
            deliveryMode: 'in-app',
            weekday: 0,
        },
        monthly: {
            enabled: false,
            time: DEFAULT_REVIEW_TIME,
            deliveryMode: 'in-app',
            dayOfMonth: 1,
        },
        quarterly: {
            enabled: false,
            time: DEFAULT_REVIEW_TIME,
            deliveryMode: 'in-app',
            daysAfterQuarterEnd: 1,
        },
    },
};

export function normalizeJournalReminderSettings(settings?: Partial<JournalReminderSettings> | null): JournalReminderSettings {
    const entryReminder = settings?.entryReminder;
    const reviewReminders = settings?.reviewReminders;

    return {
        entryReminder: {
            enabled: entryReminder?.enabled ?? DEFAULT_REMINDER_SETTINGS.entryReminder.enabled,
            time: normalizeTime(entryReminder?.time, DEFAULT_REMINDER_SETTINGS.entryReminder.time),
            deliveryMode: normalizeDeliveryMode(entryReminder?.deliveryMode),
        },
        reviewReminders: {
            weekly: {
                enabled: reviewReminders?.weekly?.enabled ?? DEFAULT_REMINDER_SETTINGS.reviewReminders.weekly.enabled,
                time: normalizeTime(reviewReminders?.weekly?.time, DEFAULT_REMINDER_SETTINGS.reviewReminders.weekly.time),
                deliveryMode: normalizeDeliveryMode(reviewReminders?.weekly?.deliveryMode),
                weekday: clampInteger(reviewReminders?.weekly?.weekday, 0, 6, DEFAULT_REMINDER_SETTINGS.reviewReminders.weekly.weekday),
            },
            monthly: {
                enabled: reviewReminders?.monthly?.enabled ?? DEFAULT_REMINDER_SETTINGS.reviewReminders.monthly.enabled,
                time: normalizeTime(reviewReminders?.monthly?.time, DEFAULT_REMINDER_SETTINGS.reviewReminders.monthly.time),
                deliveryMode: normalizeDeliveryMode(reviewReminders?.monthly?.deliveryMode),
                dayOfMonth: clampInteger(reviewReminders?.monthly?.dayOfMonth, 1, 28, DEFAULT_REMINDER_SETTINGS.reviewReminders.monthly.dayOfMonth),
            },
            quarterly: {
                enabled: reviewReminders?.quarterly?.enabled ?? DEFAULT_REMINDER_SETTINGS.reviewReminders.quarterly.enabled,
                time: normalizeTime(reviewReminders?.quarterly?.time, DEFAULT_REMINDER_SETTINGS.reviewReminders.quarterly.time),
                deliveryMode: normalizeDeliveryMode(reviewReminders?.quarterly?.deliveryMode),
                daysAfterQuarterEnd: clampInteger(reviewReminders?.quarterly?.daysAfterQuarterEnd, 0, 14, DEFAULT_REMINDER_SETTINGS.reviewReminders.quarterly.daysAfterQuarterEnd),
            },
        },
    };
}

export function hasAnyEnabledReminder(settings?: Partial<JournalReminderSettings> | null, cadence?: JournalCadenceConfig | null) {
    const normalized = normalizeJournalReminderSettings(settings);
    const entryEnabled = normalized.entryReminder.enabled && isCadenceTracked(cadence);
    const reviewEnabled = normalized.reviewReminders.weekly.enabled
        || normalized.reviewReminders.monthly.enabled
        || normalized.reviewReminders.quarterly.enabled;

    return entryEnabled || reviewEnabled;
}

export function getReminderEventsForJournal(
    context: JournalReminderContext,
    now: moment.Moment,
    reminderHistory: Record<string, ReminderOccurrenceRecord>,
): ResolvedReminderEvent[] {
    const events: ResolvedReminderEvent[] = [];

    const entryEvent = resolveEntryReminder(context, now, reminderHistory);
    if (entryEvent) {
        events.push(entryEvent);
    }

    const weeklyEvent = resolveWeeklyReviewReminder(context, now, reminderHistory);
    if (weeklyEvent) {
        events.push(weeklyEvent);
    }

    const monthlyEvent = resolveMonthlyReviewReminder(context, now, reminderHistory);
    if (monthlyEvent) {
        events.push(monthlyEvent);
    }

    const quarterlyEvent = resolveQuarterlyReviewReminder(context, now, reminderHistory);
    if (quarterlyEvent) {
        events.push(quarterlyEvent);
    }

    return events;
}

export function buildReminderHistoryKey(journalPath: string, ruleKey: string, occurrenceKey: string) {
    return `${journalPath}::${ruleKey}::${occurrenceKey}`;
}

function resolveEntryReminder(
    context: JournalReminderContext,
    now: moment.Moment,
    reminderHistory: Record<string, ReminderOccurrenceRecord>,
): ResolvedReminderEvent | null {
    const reminder = context.reminderSettings.entryReminder;
    if (!reminder.enabled || !isCadenceTracked(context.cadence)) {
        return null;
    }

    const today = now.format('YYYY-MM-DD');
    const expectedDates = getExpectedDatesInRange(
        context.cadence,
        now.clone().subtract(MAX_EXPECTATION_SCAN_DAYS, 'days').format('YYYY-MM-DD'),
        today,
    );
    const dueDate = expectedDates[expectedDates.length - 1];

    if (!dueDate || context.dateSet.has(dueDate)) {
        return null;
    }

    const dueAt = combineDateAndTime(dueDate, reminder.time);
    const nextExpectedDate = getNextExpectedDate(context.cadence, moment(dueDate, 'YYYY-MM-DD', true).add(1, 'day').format('YYYY-MM-DD'));
    const nextDueAt = nextExpectedDate ? combineDateAndTime(nextExpectedDate, reminder.time) : null;

    if (!isOccurrenceActive(now, dueAt, nextDueAt)) {
        return null;
    }

    const occurrenceKey = `${dueDate}@${reminder.time}`;
    const historyKey = buildReminderHistoryKey(context.journalPath, 'entry', occurrenceKey);

    if (reminderHistory[historyKey]) {
        return null;
    }

    return {
        historyKey,
        journalPath: context.journalPath,
        journalName: context.journalName,
        deliveryMode: reminder.deliveryMode,
        title: dueDate === today
            ? `${context.journalName} is due today`
            : `${context.journalName} entry is still missing`,
        message: dueDate === today
            ? `Create today's ${context.journalName.toLowerCase()} entry in Journalyst.`
            : `You still have a missing expected ${context.journalName.toLowerCase()} entry from ${dueDate}.`,
        target: {
            type: 'entry' as const,
            anchorDate: dueDate,
        },
    };
}

function resolveWeeklyReviewReminder(
    context: JournalReminderContext,
    now: moment.Moment,
    reminderHistory: Record<string, ReminderOccurrenceRecord>,
): ResolvedReminderEvent | null {
    const reminder = context.reminderSettings.reviewReminders.weekly;
    if (!reminder.enabled) {
        return null;
    }

    const currentWeekCandidate = now.clone().startOf('week').day(reminder.weekday);
    const dueAt = applyTime(currentWeekCandidate.clone(), reminder.time);
    const activeDueAt = now.isBefore(dueAt) ? dueAt.clone().subtract(1, 'week') : dueAt;
    const nextDueAt = activeDueAt.clone().add(1, 'week');
    const anchorDate = activeDueAt.format('YYYY-MM-DD');

    if (!isOccurrenceActive(now, activeDueAt, nextDueAt) || context.synthesisNoteExists('weekly', anchorDate)) {
        return null;
    }

    const occurrenceKey = `${anchorDate}@${reminder.time}`;
    const historyKey = buildReminderHistoryKey(context.journalPath, 'review-weekly', occurrenceKey);
    if (reminderHistory[historyKey]) {
        return null;
    }

    return {
        historyKey,
        journalPath: context.journalPath,
        journalName: context.journalName,
        deliveryMode: reminder.deliveryMode,
        title: `${context.journalName} weekly review`,
        message: `Open Journalyst synthesis to capture this week's review for ${context.journalName.toLowerCase()}.`,
        target: {
            type: 'review' as const,
            anchorDate,
            reviewPeriod: 'weekly',
        },
    };
}

function resolveMonthlyReviewReminder(
    context: JournalReminderContext,
    now: moment.Moment,
    reminderHistory: Record<string, ReminderOccurrenceRecord>,
): ResolvedReminderEvent | null {
    const reminder = context.reminderSettings.reviewReminders.monthly;
    if (!reminder.enabled) {
        return null;
    }

    const currentMonthCandidate = now.clone().startOf('month').date(reminder.dayOfMonth);
    const dueAt = applyTime(currentMonthCandidate.clone(), reminder.time);
    const activeDueAt = now.isBefore(dueAt) ? dueAt.clone().subtract(1, 'month') : dueAt;
    const nextDueAt = activeDueAt.clone().add(1, 'month');
    const anchorDate = activeDueAt.format('YYYY-MM-DD');

    if (!isOccurrenceActive(now, activeDueAt, nextDueAt) || context.synthesisNoteExists('monthly', anchorDate)) {
        return null;
    }

    const occurrenceKey = `${anchorDate}@${reminder.time}`;
    const historyKey = buildReminderHistoryKey(context.journalPath, 'review-monthly', occurrenceKey);
    if (reminderHistory[historyKey]) {
        return null;
    }

    return {
        historyKey,
        journalPath: context.journalPath,
        journalName: context.journalName,
        deliveryMode: reminder.deliveryMode,
        title: `${context.journalName} monthly reflection`,
        message: `Open Journalyst synthesis to wrap up this month's reflection for ${context.journalName.toLowerCase()}.`,
        target: {
            type: 'review' as const,
            anchorDate,
            reviewPeriod: 'monthly',
        },
    };
}

function resolveQuarterlyReviewReminder(
    context: JournalReminderContext,
    now: moment.Moment,
    reminderHistory: Record<string, ReminderOccurrenceRecord>,
): ResolvedReminderEvent | null {
    const reminder = context.reminderSettings.reviewReminders.quarterly;
    if (!reminder.enabled) {
        return null;
    }

    const currentQuarterDueAt = getQuarterlyDueAt(now.clone(), reminder.daysAfterQuarterEnd, reminder.time);
    const activeDueAt = now.isBefore(currentQuarterDueAt)
        ? getQuarterlyDueAt(now.clone().subtract(1, 'quarter'), reminder.daysAfterQuarterEnd, reminder.time)
        : currentQuarterDueAt;
    const nextDueAt = getQuarterlyDueAt(activeDueAt.clone().add(1, 'quarter'), reminder.daysAfterQuarterEnd, reminder.time);
    const anchorDate = activeDueAt.clone().subtract(Math.max(1, reminder.daysAfterQuarterEnd), 'days').format('YYYY-MM-DD');

    if (!isOccurrenceActive(now, activeDueAt, nextDueAt) || context.synthesisNoteExists('quarterly', anchorDate)) {
        return null;
    }

    const occurrenceKey = `${anchorDate}@${reminder.time}`;
    const historyKey = buildReminderHistoryKey(context.journalPath, 'review-quarterly', occurrenceKey);
    if (reminderHistory[historyKey]) {
        return null;
    }

    return {
        historyKey,
        journalPath: context.journalPath,
        journalName: context.journalName,
        deliveryMode: reminder.deliveryMode,
        title: `${context.journalName} quarter summary`,
        message: `Open Journalyst synthesis to capture this quarter's summary for ${context.journalName.toLowerCase()}.`,
        target: {
            type: 'review' as const,
            anchorDate,
            reviewPeriod: 'quarterly',
        },
    };
}

export function buildSynthesisReminderFileName(period: ReviewReminderPeriod, anchorDate: string) {
    const anchor = moment(anchorDate, 'YYYY-MM-DD', true);

    if (period === 'weekly') {
        return `weekly-review-${anchor.format('YYYY-[W]WW')}.md`;
    }

    if (period === 'monthly') {
        return `monthly-reflection-${anchor.format('YYYY-MM')}.md`;
    }

    return `quarter-summary-${anchor.format('YYYY-[Q]Q')}.md`;
}

function isOccurrenceActive(now: moment.Moment, dueAt: moment.Moment, nextDueAt: moment.Moment | null) {
    if (now.isBefore(dueAt)) {
        return false;
    }

    if (nextDueAt && !now.isBefore(nextDueAt)) {
        return false;
    }

    return true;
}

function combineDateAndTime(date: string, time: string) {
    return moment(`${date} ${time}`, 'YYYY-MM-DD HH:mm', true);
}

function applyTime(target: moment.Moment, time: string) {
    const [hour, minute] = normalizeTime(time, DEFAULT_TIME).split(':').map(value => Number.parseInt(value, 10));
    return target.clone().hour(hour).minute(minute).second(0).millisecond(0);
}

function getQuarterlyDueAt(target: moment.Moment, daysAfterQuarterEnd: number, time: string) {
    return applyTime(target.clone().endOf('quarter').add(daysAfterQuarterEnd, 'days'), time);
}

function normalizeTime(value: string | undefined, fallback: string) {
    if (!value) {
        return fallback;
    }

    const match = value.match(/^(\d{2}):(\d{2})$/);
    if (!match) {
        return fallback;
    }

    const hour = Number.parseInt(match[1], 10);
    const minute = Number.parseInt(match[2], 10);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return fallback;
    }

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function normalizeDeliveryMode(value: ReminderDeliveryMode | undefined) {
    return value === 'os-preferred' ? 'os-preferred' : 'in-app';
}

function clampInteger(value: number | undefined, min: number, max: number, fallback: number) {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
        return fallback;
    }

    return Math.max(min, Math.min(max, value));
}
