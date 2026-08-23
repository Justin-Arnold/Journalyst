<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type {
    SynthesisPeriodType,
    SynthesisPreviewRequest,
    SynthesisWorkspaceSnapshot,
} from '../../../review/types';
import AlertCard from '../AlertCard.vue';
import SynthesisHistory from './SynthesisHistory.vue';
import SynthesisPeriodCard from './SynthesisPeriodCard.vue';

const props = defineProps<{
    snapshot: SynthesisWorkspaceSnapshot;
    focusedPeriod?: SynthesisPeriodType | null;
}>();

const emit = defineEmits<{
    openNote: [filePath: string];
    createNote: [periodType: SynthesisPeriodType];
    previewNote: [request: SynthesisPreviewRequest];
}>();

const root = ref<HTMLElement | null>(null);
const savedDescription = computed(() => {
    const count = props.snapshot.savedCurrentCount;
    return `${count} of 3 selected-period ${count === 1 ? 'notes is' : 'notes are'} already saved.`;
});

function previewPeriod(periodType: SynthesisPeriodType) {
    const preview = props.snapshot.periods.find(period => period.periodType === periodType);
    if (!preview) return;

    emit('previewNote', {
        journalPath: props.snapshot.journalPath,
        anchorDate: props.snapshot.anchorDate,
        periodType,
        title: preview.title,
        generatedBody: preview.payload.body,
        existingFilePath: preview.existingFilePath,
    });
}

watch(() => props.focusedPeriod, async periodType => {
    if (!periodType) return;

    await nextTick();
    const card = root.value?.querySelector<HTMLElement>(`[data-synthesis-period="${periodType}"]`);
    card?.focus({ preventScroll: true });
    card?.scrollIntoView({ block: 'nearest' });
}, { immediate: true });
</script>

<template>
    <div ref="root" class="journalyst-synthesis-workspace">
        <AlertCard
            tone="accent"
            icon="sparkles"
            title="What synthesis does"
            :description="`Pulls completed entries from each period, summarizes factual patterns, and prepares reflection prompts. ${savedDescription}`"
        />

        <section class="journalyst-synthesis-period-list" aria-label="Synthesis periods">
            <SynthesisPeriodCard
                v-for="preview in snapshot.periods"
                :key="preview.periodType"
                :journal-path="snapshot.journalPath"
                :preview="preview"
                :focused="preview.periodType === focusedPeriod"
                @open-note="emit('openNote', $event)"
                @create-note="emit('createNote', preview.periodType)"
                @preview-note="previewPeriod(preview.periodType)"
            />
        </section>

        <SynthesisHistory :items="snapshot.history" @open-note="emit('openNote', $event)" />
    </div>
</template>

<style scoped>
.journalyst-synthesis-workspace {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: var(--size-4-6);
}

.journalyst-synthesis-period-list {
    display: grid;
    min-width: 0;
    gap: var(--size-4-4);
}
</style>
