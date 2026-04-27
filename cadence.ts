import moment from "moment";

export type JournalCadenceType = 'daily' | 'weekdays' | 'weekly-days' | 'interval' | 'adhoc';

export interface JournalCadenceConfig {
    type: JournalCadenceType;
    weekdays?: number[];
    intervalDays?: number;
    startDate?: string;
}

export interface JournalCadenceStatus {
    isTracked: boolean;
    cadenceLabel: string;
    expectedToday: boolean;
    outstandingMisses: number;
    nextExpectedDate: string | null;
}

const DEFAULT_CADENCE: JournalCadenceConfig = {
    type: 'daily',
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DEFAULT_INTERVAL_DAYS = 3;
const MAX_EXPECTATION_SCAN_DAYS = 730;

export function normalizeJournalCadence(cadence?: JournalCadenceConfig | null): JournalCadenceConfig {
    if (!cadence) {
        return DEFAULT_CADENCE;
    }

    if (cadence.type === 'weekly-days') {
        const weekdays = Array.from(new Set((cadence.weekdays ?? []).filter(day => day >= 0 && day <= 6))).sort((left, right) => left - right);
        return {
            type: 'weekly-days',
            weekdays: weekdays.length > 0 ? weekdays : [1],
        };
    }

    if (cadence.type === 'interval') {
        return {
            type: 'interval',
            intervalDays: Math.max(1, cadence.intervalDays ?? DEFAULT_INTERVAL_DAYS),
            startDate: isValidDate(cadence.startDate) ? cadence.startDate : moment().format('YYYY-MM-DD'),
        };
    }

    if (cadence.type === 'weekdays' || cadence.type === 'adhoc' || cadence.type === 'daily') {
        return {
            type: cadence.type,
        };
    }

    return DEFAULT_CADENCE;
}

export function isCadenceTracked(cadence?: JournalCadenceConfig | null) {
    return normalizeJournalCadence(cadence).type !== 'adhoc';
}

export function getCadenceLabel(cadence?: JournalCadenceConfig | null) {
    const normalized = normalizeJournalCadence(cadence);

    if (normalized.type === 'weekdays') {
        return 'Weekdays only';
    }

    if (normalized.type === 'weekly-days') {
        return normalized.weekdays!.map(day => WEEKDAY_LABELS[day]).join(', ');
    }

    if (normalized.type === 'interval') {
        return `Every ${normalized.intervalDays} day${normalized.intervalDays === 1 ? '' : 's'}`;
    }

    if (normalized.type === 'adhoc') {
        return 'Ad hoc';
    }

    return 'Daily';
}

export function isExpectedOnDate(cadence: JournalCadenceConfig | null | undefined, date: string) {
    const normalized = normalizeJournalCadence(cadence);
    const target = moment(date, 'YYYY-MM-DD', true);

    if (!target.isValid() || normalized.type === 'adhoc') {
        return false;
    }

    if (normalized.type === 'daily') {
        return true;
    }

    if (normalized.type === 'weekdays') {
        const weekday = target.day();
        return weekday >= 1 && weekday <= 5;
    }

    if (normalized.type === 'weekly-days') {
        return normalized.weekdays!.includes(target.day());
    }

    const start = moment(normalized.startDate, 'YYYY-MM-DD', true);
    if (!start.isValid() || target.isBefore(start, 'day')) {
        return false;
    }

    return target.diff(start, 'days') % normalized.intervalDays! === 0;
}

export function getExpectedDatesInRange(cadence: JournalCadenceConfig | null | undefined, startDate: string, endDate: string) {
    const normalized = normalizeJournalCadence(cadence);
    if (normalized.type === 'adhoc') {
        return [];
    }

    const start = moment(startDate, 'YYYY-MM-DD', true);
    const end = moment(endDate, 'YYYY-MM-DD', true);
    if (!start.isValid() || !end.isValid() || start.isAfter(end, 'day')) {
        return [];
    }

    const expectedDates: string[] = [];
    let cursor = start.clone();

    while (cursor.isSameOrBefore(end, 'day')) {
        const date = cursor.format('YYYY-MM-DD');
        if (isExpectedOnDate(normalized, date)) {
            expectedDates.push(date);
        }
        cursor.add(1, 'day');
    }

    return expectedDates;
}

export function getCurrentCadenceStreak(cadence: JournalCadenceConfig | null | undefined, dateSet: Set<string>, anchorDate: string) {
    const normalized = normalizeJournalCadence(cadence);
    if (normalized.type === 'adhoc') {
        return 0;
    }

    const expectedDates = getExpectedDatesInRange(
        normalized,
        moment(anchorDate, 'YYYY-MM-DD', true).clone().subtract(MAX_EXPECTATION_SCAN_DAYS, 'days').format('YYYY-MM-DD'),
        anchorDate,
    );

    let streak = 0;
    for (let index = expectedDates.length - 1; index >= 0; index -= 1) {
        if (!dateSet.has(expectedDates[index])) {
            if (streak === 0) {
                return 0;
            }
            break;
        }

        streak += 1;
    }

    return streak;
}

export function getLongestCadenceStreak(cadence: JournalCadenceConfig | null | undefined, dateSet: Set<string>, dates: string[]) {
    const normalized = normalizeJournalCadence(cadence);
    if (normalized.type === 'adhoc' || dates.length === 0) {
        return 0;
    }

    const expectedDates = getExpectedDatesInRange(normalized, dates[0], dates[dates.length - 1]);
    let longest = 0;
    let current = 0;

    expectedDates.forEach(date => {
        if (dateSet.has(date)) {
            current += 1;
            if (current > longest) {
                longest = current;
            }
            return;
        }

        current = 0;
    });

    return longest;
}

export function getLongestMissStretch(cadence: JournalCadenceConfig | null | undefined, dateSet: Set<string>, startDate: string | null, endDate: string) {
    const normalized = normalizeJournalCadence(cadence);
    if (normalized.type === 'adhoc' || !startDate) {
        return 0;
    }

    const expectedDates = getExpectedDatesInRange(normalized, startDate, endDate);
    let longest = 0;
    let current = 0;

    expectedDates.forEach(date => {
        if (dateSet.has(date)) {
            current = 0;
            return;
        }

        current += 1;
        if (current > longest) {
            longest = current;
        }
    });

    return longest;
}

export function getCadenceStatus(cadence: JournalCadenceConfig | null | undefined, dateSet: Set<string>, anchorDate: string, firstEntryDate: string | null): JournalCadenceStatus {
    const normalized = normalizeJournalCadence(cadence);
    if (normalized.type === 'adhoc') {
        return {
            isTracked: false,
            cadenceLabel: getCadenceLabel(normalized),
            expectedToday: false,
            outstandingMisses: 0,
            nextExpectedDate: null,
        };
    }

    const expectedToday = isExpectedOnDate(normalized, anchorDate);
    const scanStart = firstEntryDate ?? anchorDate;
    const expectedDates = getExpectedDatesInRange(normalized, scanStart, anchorDate);
    let outstandingMisses = 0;

    for (let index = expectedDates.length - 1; index >= 0; index -= 1) {
        if (dateSet.has(expectedDates[index])) {
            break;
        }
        outstandingMisses += 1;
    }

    return {
        isTracked: true,
        cadenceLabel: getCadenceLabel(normalized),
        expectedToday,
        outstandingMisses,
        nextExpectedDate: getNextExpectedDate(normalized, anchorDate),
    };
}

export function getNextExpectedDate(cadence: JournalCadenceConfig | null | undefined, anchorDate: string) {
    const normalized = normalizeJournalCadence(cadence);
    if (normalized.type === 'adhoc') {
        return null;
    }

    const anchor = moment(anchorDate, 'YYYY-MM-DD', true);
    if (!anchor.isValid()) {
        return null;
    }

    for (let offset = 0; offset <= MAX_EXPECTATION_SCAN_DAYS; offset += 1) {
        const date = anchor.clone().add(offset, 'days').format('YYYY-MM-DD');
        if (isExpectedOnDate(normalized, date)) {
            return date;
        }
    }

    return null;
}

function isValidDate(date?: string) {
    return !!date && moment(date, 'YYYY-MM-DD', true).isValid();
}
