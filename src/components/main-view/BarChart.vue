<script setup lang="ts">
import { computed } from "vue";
import type { DistributionDatum } from "../../../review/types";

const props = defineProps<{
    data: DistributionDatum[];
    variant?: 'weekday' | 'month';
}>();

const maxValue = computed(() => Math.max(...props.data.map(item => item.value), 1));
</script>

<template>
    <div class="journalyst-review-bar-chart" :class="{ 'journalyst-review-month-chart': variant === 'month' }">
        <div v-for="item in data" :key="item.label" class="journalyst-review-bar-column">
            <div
                class="journalyst-review-bar"
                :class="{ 'is-empty': item.value === 0 }"
                :style="{ height: `${Math.max(8, (item.value / maxValue) * 100)}%` }"
                :title="`${item.label}: ${item.value}`"
                role="img"
                :aria-label="`${item.label}: ${item.value}`"
            />
            <span class="journalyst-review-bar-label">{{ item.label }}</span>
        </div>
    </div>
</template>
