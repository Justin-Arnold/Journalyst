<script setup lang="ts">
import type { ReviewWorkspaceTab } from "../../review/types";

defineProps<{
    activeTab: ReviewWorkspaceTab;
    journals: Array<{ path: string; name: string }>;
}>();

const journalPath = defineModel<string>('journalPath', { required: true });
const anchorDate = defineModel<string>('anchorDate', { required: true });
</script>

<template>
    <header class="journalyst-review-header">
        <h1>Journalyst</h1>
        <div v-if="activeTab !== 'home'" class="journalyst-review-controls">
            <label class="journalyst-review-control">
                <span>Journal</span>
                <select v-model="journalPath">
                    <option v-for="journal in journals" :key="journal.path" :value="journal.path">
                        {{ journal.name }}
                    </option>
                </select>
            </label>
            <label class="journalyst-review-control">
                <span>Anchor date</span>
                <input v-model="anchorDate" type="date">
            </label>
        </div>
    </header>
</template>

<style scoped>
.journalyst-review-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1.25rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
}

.journalyst-review-header h1 {
    font-size: 1.8rem;
    line-height: 1.15;
    margin: 0;
}

.journalyst-review-controls {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-left: auto;
}

.journalyst-review-control {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 220px;
    flex: 1 1 220px;
}

.journalyst-review-control span {
    font-size: 0.8rem;
    color: var(--text-muted);
}

.journalyst-review-control select,
.journalyst-review-control input {
    width: 100%;
}

@media (max-width: 700px) {
    .journalyst-review-controls {
        width: 100%;
        margin-left: 0;
    }

    .journalyst-review-control {
        min-width: 0;
        flex: 1 1 100%;
    }
}

@media (max-width: 430px) {
    .journalyst-review-header h1 {
        font-size: 1.5rem;
    }
}
</style>
