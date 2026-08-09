import moment from "moment";

export type JournalCadenceType = 'daily' | 'weekdays' | 'weekly-days' | 'interval' | 'adhoc';

export interface JournalCadenceConfig {
    type: JournalCadenceType;
    weekdays?: number[];
    intervalDays?: number;
    startDate?: string;
}

export interface JournalCadenceRevision {
    effectiveFrom: string;
    cadence: JournalCadenceConfig;
}

export interface JournalSchedulePause {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
}

export type JournalCadenceTimeline = JournalCadenceRevision[];

export interface JournalCadenceSchedule {
    timeline: JournalCadenceTimeline;
    pauses: JournalSchedulePause[];
}

export type JournalCadenceSource = JournalCadenceConfig | JournalCadenceTimeline | JournalCadenceSchedule | null | undefined;

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

export function normalizeJournalCadenceTimeline(timeline?: JournalCadenceTimeline | null): JournalCadenceTimeline {
    const revisionsByDate = new Map<string, JournalCadenceRevision>();
    const revisions = Array.isArray(timeline) ? timeline : [];

    revisions.forEach(revision => {
        if (!isValidDate(revision?.effectiveFrom)) {
            return;
        }

        revisionsByDate.set(revision.effectiveFrom, {
            effectiveFrom: revision.effectiveFrom,
            cadence: normalizeJournalCadence(revision.cadence),
        });
    });

    return [...revisionsByDate.values()]
        .sort((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom));
}

export function normalizeJournalSchedulePauses(pauses?: JournalSchedulePause[] | null): JournalSchedulePause[] {
    const normalizedById = new Map<string, JournalSchedulePause>();

    (Array.isArray(pauses) ? pauses : []).forEach(pause => {
        const id = typeof pause?.id === 'string' ? pause.id.trim() : '';
        const name = typeof pause?.name === 'string' ? pause.name.trim() : '';
        if (!id || !name || !isValidDate(pause?.startDate) || !isValidDate(pause?.endDate) || pause.startDate > pause.endDate) {
            return;
        }

        normalizedById.set(id, {
            id,
            name,
            startDate: pause.startDate,
            endDate: pause.endDate,
        });
    });

    return [...normalizedById.values()].sort((left, right) => (
        left.startDate.localeCompare(right.startDate)
        || left.endDate.localeCompare(right.endDate)
        || left.name.localeCompare(right.name)
    ));
}

export function createJournalCadenceSchedule(
    timeline: JournalCadenceTimeline,
    pauses?: JournalSchedulePause[] | null,
): JournalCadenceSchedule {
    return {
        timeline: normalizeJournalCadenceTimeline(timeline),
        pauses: normalizeJournalSchedulePauses(pauses),
    };
}

export function getCadenceForDate(source: JournalCadenceSource, date: string): JournalCadenceConfig | null {
    const cadenceSource = isJournalCadenceSchedule(source) ? source.timeline : source;
    if (!Array.isArray(cadenceSource)) {
        return normalizeJournalCadence(cadenceSource);
    }

    if (!isValidDate(date)) {
        return null;
    }

    const timeline = normalizeJournalCadenceTimeline(cadenceSource);
    let activeCadence: JournalCadenceConfig | null = null;

    for (const revision of timeline) {
        if (revision.effectiveFrom > date) {
            break;
        }
        activeCadence = revision.cadence;
    }

    return activeCadence;
}

export function getCurrentJournalCadence(source: JournalCadenceSource, anchorDate = moment().format('YYYY-MM-DD')) {
    return getCadenceForDate(source, anchorDate) ?? DEFAULT_CADENCE;
}

export function getCadenceTimelineStartDate(source: JournalCadenceSource) {
    const cadenceSource = isJournalCadenceSchedule(source) ? source.timeline : source;
    return Array.isArray(cadenceSource)
        ? normalizeJournalCadenceTimeline(cadenceSource)[0]?.effectiveFrom ?? null
        : null;
}

export function isCadenceTracked(source: JournalCadenceSource, date = moment().format('YYYY-MM-DD')) {
    const cadence = getCadenceForDate(source, date);
    return !!cadence && cadence.type !== 'adhoc';
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

export function getCompactCadenceLabel(cadence?: JournalCadenceConfig | null) {
    const normalized = normalizeJournalCadence(cadence);

    if (normalized.type === 'weekdays') {
        return 'M-F';
    }

    if (normalized.type === 'weekly-days') {
        const weekdays = normalized.weekdays ?? [];
        if (weekdays.length === 1) {
            return WEEKDAY_LABELS[weekdays[0]];
        }
        return weekdays.map(day => WEEKDAY_LABELS[day][0]).join(' · ');
    }

    return getCadenceLabel(normalized);
}

export function isExpectedOnDate(source: JournalCadenceSource, date: string) {
    const cadence = getCadenceForDate(source, date);
    const target = moment(date, 'YYYY-MM-DD', true);

    if (!target.isValid() || !cadence || cadence.type === 'adhoc' || isSchedulePausedOnDate(source, date)) {
        return false;
    }

    if (cadence.type === 'daily') {
        return true;
    }

    if (cadence.type === 'weekdays') {
        const weekday = target.day();
        return weekday >= 1 && weekday <= 5;
    }

    if (cadence.type === 'weekly-days') {
        return cadence.weekdays!.includes(target.day());
    }

    const start = moment(cadence.startDate, 'YYYY-MM-DD', true);
    if (!start.isValid() || target.isBefore(start, 'day')) {
        return false;
    }

    return target.diff(start, 'days') % cadence.intervalDays! === 0;
}

export function getExpectedDatesInRange(source: JournalCadenceSource, startDate: string, endDate: string) {
    const start = moment(startDate, 'YYYY-MM-DD', true);
    const end = moment(endDate, 'YYYY-MM-DD', true);
    if (!start.isValid() || !end.isValid() || start.isAfter(end, 'day')) {
        return [];
    }

    const expectedDates: string[] = [];
    let cursor = start.clone();

    while (cursor.isSameOrBefore(end, 'day')) {
        const date = cursor.format('YYYY-MM-DD');
        if (isExpectedOnDate(source, date)) {
            expectedDates.push(date);
        }
        cursor.add(1, 'day');
    }

    return expectedDates;
}

export function hasTrackedCadenceInRange(source: JournalCadenceSource, startDate: string, endDate: string) {
    const start = moment(startDate, 'YYYY-MM-DD', true);
    const end = moment(endDate, 'YYYY-MM-DD', true);
    if (!start.isValid() || !end.isValid() || start.isAfter(end, 'day')) {
        return false;
    }

    let cursor = start.clone();
    while (cursor.isSameOrBefore(end, 'day')) {
        const date = cursor.format('YYYY-MM-DD');
        if (isCadenceTracked(source, date) && !isSchedulePausedOnDate(source, date)) {
            return true;
        }
        cursor.add(1, 'day');
    }

    return false;
}

export function getCurrentCadenceStreak(source: JournalCadenceSource, dateSet: Set<string>, anchorDate: string) {
    const expectedDates = getExpectedDatesInRange(
        source,
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

export function getLongestCadenceStreak(source: JournalCadenceSource, dateSet: Set<string>, dates: string[]) {
    if (dates.length === 0) {
        return 0;
    }

    const expectedDates = getExpectedDatesInRange(source, dates[0], dates[dates.length - 1]);
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

export function getLongestMissStretch(source: JournalCadenceSource, dateSet: Set<string>, startDate: string | null, endDate: string) {
    if (!startDate) {
        return 0;
    }

    const expectedDates = getExpectedDatesInRange(source, startDate, endDate);
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

export function getCadenceStatus(source: JournalCadenceSource, dateSet: Set<string>, anchorDate: string, firstEntryDate: string | null): JournalCadenceStatus {
    const cadence = getCadenceForDate(source, anchorDate);
    if (!cadence || cadence.type === 'adhoc') {
        return {
            isTracked: false,
            cadenceLabel: cadence ? getCadenceLabel(cadence) : 'Not scheduled yet',
            expectedToday: false,
            outstandingMisses: 0,
            nextExpectedDate: null,
        };
    }

    const expectedToday = isExpectedOnDate(source, anchorDate);
    const timelineStartDate = getCadenceTimelineStartDate(source);
    const scanStart = timelineStartDate ?? firstEntryDate ?? anchorDate;
    const expectedDates = getExpectedDatesInRange(source, scanStart, anchorDate);
    let outstandingMisses = 0;

    for (let index = expectedDates.length - 1; index >= 0; index -= 1) {
        if (dateSet.has(expectedDates[index])) {
            break;
        }
        outstandingMisses += 1;
    }

    return {
        isTracked: true,
        cadenceLabel: getCadenceLabel(cadence),
        expectedToday,
        outstandingMisses,
        nextExpectedDate: getNextExpectedDate(source, anchorDate),
    };
}

export function getNextExpectedDate(source: JournalCadenceSource, anchorDate: string) {
    const anchor = moment(anchorDate, 'YYYY-MM-DD', true);
    if (!anchor.isValid()) {
        return null;
    }

    for (let offset = 0; offset <= MAX_EXPECTATION_SCAN_DAYS; offset += 1) {
        const date = anchor.clone().add(offset, 'days').format('YYYY-MM-DD');
        if (isExpectedOnDate(source, date)) {
            return date;
        }
    }

    return null;
}

export function getNextExpectedDates(
    source: JournalCadenceSource,
    anchorDate: string,
    count: number,
) {
    const dates: string[] = [];
    let cursor = moment(anchorDate, 'YYYY-MM-DD', true);
    if (!cursor.isValid() || count <= 0) {
        return dates;
    }

    for (let offset = 0; offset <= MAX_EXPECTATION_SCAN_DAYS && dates.length < count; offset += 1) {
        const date = cursor.format('YYYY-MM-DD');
        if (isExpectedOnDate(source, date)) {
            dates.push(date);
        }
        cursor = cursor.add(1, 'day');
    }

    return dates;
}

export function isSchedulePausedOnDate(source: JournalCadenceSource, date: string) {
    if (!isJournalCadenceSchedule(source) || !isValidDate(date)) {
        return false;
    }

    return normalizeJournalSchedulePauses(source.pauses)
        .some(pause => pause.startDate <= date && pause.endDate >= date);
}

function isJournalCadenceSchedule(source: JournalCadenceSource): source is JournalCadenceSchedule {
    return !!source
        && !Array.isArray(source)
        && typeof source === 'object'
        && 'timeline' in source
        && 'pauses' in source;
}

function isValidDate(date?: string) {
    return !!date && moment(date, 'YYYY-MM-DD', true).isValid();
}
