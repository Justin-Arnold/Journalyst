<script setup lang="ts">
import { computed } from "vue";
import moment from "moment";
import type { JournalHeatmapDay } from "../../../review/buildHomeSnapshot";

const props = defineProps<{
    days: JournalHeatmapDay[];
}>();

defineEmits<{
    select: [date: string];
}>();

const weekdayLabels = ['S', 'M', 'T', 'W', 'Th', 'F', 'S'];
const startOffset = computed(() => {
    const firstDate = props.days[0]?.date;
    return firstDate ? moment(firstDate, 'YYYY-MM-DD', true).day() : 0;
});
</script>

<template>
    <div class="heat-map-wrapper" aria-label="Current month entries">
        <span v-for="label in weekdayLabels" :key="label" class="heat-map-day-label" aria-hidden="true">
            {{ label }}
        </span>
        <span v-for="index in startOffset" :key="`offset-${index}`" class="heat-map-offset" aria-hidden="true" />
        <button
            v-for="day in days"
            :key="day.date"
            type="button"
            class="heat-map-day"
            :class="{ 'heat-map-day-exists': day.hasEntry }"
            :aria-label="`${day.hasEntry ? 'Open' : 'Create'} journal entry for ${day.date}`"
            :title="`${day.hasEntry ? 'Open' : 'Create'} entry for ${day.date}`"
            @click="$emit('select', day.date)"
        >
            {{ day.dayNumber }}
        </button>
    </div>
</template>
