<script setup lang="ts">
import { computed } from 'vue';
import type {
    JournalReviewSnapshot,
    ReviewLookbackPreview,
} from '../../../review/types';
import AlertCard from '../AlertCard.vue';
import ObsidianIcon from '../ObsidianIcon.vue';
import ReviewActivity from './ReviewActivity.vue';
import ReviewInsightsStrip from './ReviewInsightsStrip.vue';
import ReviewLookbacks from './ReviewLookbacks.vue';
import ReviewPeriodSummaries from './ReviewPeriodSummaries.vue';
import ReviewSummaryStrip from './ReviewSummaryStrip.vue';

const props = defineProps<{
    snapshot: JournalReviewSnapshot;
    lookbackPreviews: ReviewLookbackPreview[];
    lookbacksLoading: boolean;
}>();

const emit = defineEmits<{
    openNote: [filePath: string];
    createToday: [target: { journalPath: string; date: string }];
}>();

const showTodayAction = computed(() => (
    props.snapshot.todayAction.kind === 'write'
    || props.snapshot.todayAction.kind === 'continue'
));

const todayActionIcon = computed(() => props.snapshot.todayAction.kind === 'continue'
    ? 'file-pen-line'
    : 'plus');

const highlight = computed(() => {
    const { insights, currentMonthSummary, entryCount, anchor } = props.snapshot;
    if (insights.currentStreak > 0) {
        return {
            tone: 'success' as const,
            icon: 'trending-up',
            title: `${insights.currentStreak}-entry streak going`,
            description: `Your longest consistency run in this journal is ${insights.longestStreak} expected ${insights.longestStreak === 1 ? 'entry' : 'entries'}.`,
        };
    }

    if (currentMonthSummary.tracked && currentMonthSummary.totalDays > 0) {
        return {
            tone: currentMonthSummary.completionRate === 100 ? 'success' as const : 'accent' as const,
            icon: currentMonthSummary.completionRate === 100 ? 'circle-check' : 'chart-no-axes-column-increasing',
            title: `${currentMonthSummary.completionRate}% complete this month`,
            description: `${currentMonthSummary.completedDays} of ${currentMonthSummary.totalDays} expected entries are complete through ${anchor.date}.`,
        };
    }

    return {
        tone: 'neutral' as const,
        icon: 'history',
        title: entryCount > 0
            ? `${entryCount} ${entryCount === 1 ? 'entry is' : 'entries are'} ready to revisit`
            : 'Your review starts with the first entry',
        description: entryCount > 0
            ? 'Use the activity and lookback sections below to return to what you wrote.'
            : 'Once you begin writing, Journalyst will surface your activity and patterns here.',
    };
});

</script>

<template>
    <ReviewSummaryStrip :snapshot="snapshot" />

    <div class="journalyst-review-highlight">
        <AlertCard
            :tone="highlight.tone"
            :icon="highlight.icon"
            :title="highlight.title"
            :description="highlight.description"
        >
            <template v-if="showTodayAction" #actions>
                <button
                    type="button"
                    @click="emit('createToday', {
                        journalPath: snapshot.journalPath,
                        date: snapshot.todayAction.date,
                    })"
                >
                    <ObsidianIcon :name="todayActionIcon" />
                    {{ snapshot.todayAction.label }}
                </button>
            </template>
        </AlertCard>
    </div>

    <ReviewActivity
        :cells="snapshot.recentActivity"
        @open-note="emit('openNote', $event)"
    />

    <ReviewLookbacks
        :lookbacks="snapshot.lookbacks"
        :previews="lookbackPreviews"
        :loading="lookbacksLoading"
        @open-note="emit('openNote', $event)"
    />

    <ReviewPeriodSummaries
        :calendar-summaries="snapshot.calendarSummaries"
        :rolling-summaries="snapshot.rollingSummaries"
    />

    <ReviewInsightsStrip :snapshot="snapshot" />
</template>

<style scoped>
.journalyst-review-highlight {
    margin-bottom: var(--size-4-6);
}
</style>
