<script setup lang="ts">
import type { AnalyticsCallout } from "../../../review/types";
import WorkspaceSection from "./WorkspaceSection.vue";

defineProps<{
    title: string;
    callouts: AnalyticsCallout[];
}>();
</script>

<template>
    <WorkspaceSection v-if="callouts.length" :title="title">
        <div class="journalyst-review-grid">
            <article v-for="callout in callouts" :key="`${callout.title}-${callout.body}`" class="journalyst-review-card">
                <span class="journalyst-review-label">{{ callout.title }}</span>
                <strong>{{ callout.body }}</strong>
            </article>
        </div>
    </WorkspaceSection>
</template>
