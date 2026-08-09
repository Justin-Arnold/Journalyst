<script setup lang="ts">
import type { ActivityCell } from "../../../review/types";

defineProps<{
    cells: ActivityCell[];
}>();

function getStatus(cell: ActivityCell) {
    if (cell.isComplete) return 'entry written';
    if (cell.hasEntry) return 'unfinished entry';
    return cell.isExpected ? 'expected but missed' : 'not expected';
}
</script>

<template>
    <div class="journalyst-review-activity-strip" aria-label="Recent journal activity">
        <span
            v-for="cell in cells"
            :key="cell.date"
            class="journalyst-review-activity-cell"
            :class="{
                'is-active': cell.isComplete,
                'is-draft': cell.hasEntry && !cell.isComplete,
                'is-missed': !cell.hasEntry && cell.isExpected,
            }"
            :aria-label="`${cell.date}: ${getStatus(cell)}`"
            :title="`${cell.date}: ${getStatus(cell)}`"
        />
    </div>
</template>
