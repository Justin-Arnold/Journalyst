<script setup lang="ts">
import type { SynthesisPeriodType } from "../../../review/types";
import type { SynthesisPreviewModel } from "./types";
import WorkspaceSection from "./WorkspaceSection.vue";

defineProps<{
    previews: SynthesisPreviewModel[];
}>();

defineEmits<{
    openNote: [filePath: string];
    createNote: [periodType: SynthesisPeriodType];
}>();
</script>

<template>
    <WorkspaceSection title="Synthesis" description="Turn the current review period into a structured reflection note.">
        <div class="journalyst-review-grid journalyst-synthesis-grid">
            <article v-for="item in previews" :key="item.preview.periodType" class="journalyst-review-card journalyst-synthesis-card">
                <div class="journalyst-synthesis-heading">
                    <span class="journalyst-review-label">{{ item.preview.periodType }}</span>
                    <span class="journalyst-home-status-badge">{{ item.exists ? 'Note exists' : 'Ready to create' }}</span>
                </div>
                <h3>{{ item.preview.title }}</h3>
                <span class="journalyst-review-meta">{{ item.preview.startDate }} to {{ item.preview.endDate }}</span>
                <span class="journalyst-review-meta">
                    <template v-if="item.preview.summary.tracked">
                        {{ item.preview.summary.completedDays }}/{{ item.preview.summary.totalDays }} expected entries
                        ({{ item.preview.summary.completionRate }}%)
                    </template>
                    <template v-else>Ad hoc journal; completion is not scored.</template>
                </span>

                <div class="journalyst-synthesis-list">
                    <span class="journalyst-review-label">Notable entries</span>
                    <template v-if="!item.preview.notableEntries.length">
                        <span class="journalyst-review-meta">No entries in this period yet.</span>
                    </template>
                    <template v-else>
                        <button
                            v-for="entry in item.preview.notableEntries"
                            :key="entry.filePath"
                            type="button"
                            class="journalyst-synthesis-link"
                            @click="$emit('openNote', entry.filePath)"
                        >
                            {{ entry.displayLabel }}
                        </button>
                    </template>
                </div>

                <div class="journalyst-synthesis-list">
                    <span class="journalyst-review-label">Reflection prompts</span>
                    <p v-for="prompt in item.preview.reflectionPrompts" :key="prompt" class="journalyst-review-meta">
                        {{ prompt }}
                    </p>
                </div>

                <button type="button" class="mod-cta journalyst-synthesis-action" @click="$emit('createNote', item.preview.periodType)">
                    {{ item.exists ? 'Open note' : 'Create note' }}
                </button>
            </article>
        </div>
    </WorkspaceSection>
</template>
