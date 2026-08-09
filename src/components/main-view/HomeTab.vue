<script setup lang="ts">
import type { ReviewWorkspaceTab } from "../../../review/types";
import type {
    JournalHomeAttentionItem,
    JournalHomeAttentionTarget,
    JournalHomeSummary,
    JournalOverviewData,
} from "../../../review/buildHomeSnapshot";
import HomeAttentionSection from "./HomeAttentionSection.vue";
import HomeJournalsSection from "./HomeJournalsSection.vue";
import HomeSummaryStrip from "./HomeSummaryStrip.vue";

defineProps<{
    summary: JournalHomeSummary;
    attentionItems: JournalHomeAttentionItem[];
    journals: JournalOverviewData[];
}>();

const emit = defineEmits<{
    createEntry: [journalPath: string, date?: string];
    activateTab: [journalPath: string, tab: ReviewWorkspaceTab];
    attentionAction: [target: JournalHomeAttentionTarget];
    openSettings: [];
}>();
</script>

<template>
    <HomeSummaryStrip :summary="summary" />

    <HomeAttentionSection
        :items="attentionItems"
        @activate="emit('attentionAction', $event)"
    />

    <HomeJournalsSection
        :journals="journals"
        @create-entry="emit('createEntry', $event.journalPath, $event.date)"
        @activate-tab="emit('activateTab', $event.journalPath, $event.tab)"
        @open-settings="emit('openSettings')"
    />
</template>
