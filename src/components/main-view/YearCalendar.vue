<script setup lang="ts">
import { computed } from "vue";
import type { YearActivityCell } from "../../../review/types";

const props = defineProps<{
    cells: YearActivityCell[];
}>();

const weeks = computed(() => {
    const chunks: YearActivityCell[][] = [];
    for (let index = 0; index < props.cells.length; index += 7) {
        chunks.push(props.cells.slice(index, index + 7));
    }
    return chunks;
});

function getStatus(cell: YearActivityCell) {
    if (cell.hasEntry) return 'entry written';
    if (cell.isExpected && !cell.isFuture) return 'expected but missed';
    if (cell.isFuture) return 'future day';
    return 'not expected';
}
</script>

<template>
    <div class="journalyst-review-year-calendar" aria-label="Yearly consistency calendar">
        <div v-for="(week, weekIndex) in weeks" :key="weekIndex" class="journalyst-review-year-week">
            <span
                v-for="cell in week"
                :key="cell.date"
                class="journalyst-review-year-cell"
                :class="{
                    'is-active': cell.hasEntry,
                    'is-missed': !cell.hasEntry && cell.isExpected && !cell.isFuture,
                    'is-future': cell.isFuture,
                }"
                :title="`${cell.date}: ${getStatus(cell)}`"
                :aria-label="`${cell.date}: ${getStatus(cell)}`"
            />
        </div>
    </div>
</template>
