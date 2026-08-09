<script setup lang="ts">
defineProps<{
    todayExists: boolean;
    includeSynthesis?: boolean;
    compact?: boolean;
}>();

defineEmits<{
    today: [];
    navigate: [tab: 'review' | 'synthesis'];
}>();
</script>

<template>
    <div class="journal-section-actions" :class="{ 'journalyst-home-actions-compact': compact }">
        <button type="button" class="journal-section-button" @click="$emit('today')">
            {{ todayExists ? 'Open today' : 'Go to today' }}
        </button>
        <button type="button" class="journal-section-button" @click="$emit('navigate', 'review')">
            Review
        </button>
        <button
            v-if="includeSynthesis"
            type="button"
            class="journal-section-button"
            @click="$emit('navigate', 'synthesis')"
        >
            Synthesis
        </button>
    </div>
</template>
