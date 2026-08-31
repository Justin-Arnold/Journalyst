<script setup lang="ts">
import ObsidianIcon from './ObsidianIcon.vue';

interface SegmentedControlOption {
    value: string;
    label: string;
    icon?: string;
    disabled?: boolean;
}

withDefaults(defineProps<{
    modelValue: string;
    options: readonly SegmentedControlOption[];
    label: string;
    disabled?: boolean;
    stretch?: boolean;
}>(), {
    disabled: false,
    stretch: false,
});

const emit = defineEmits<{
    'update:modelValue': [value: string];
    change: [value: string];
}>();

function select(value: string) {
    emit('update:modelValue', value);
    emit('change', value);
}
</script>

<template>
    <div
        class="journalyst-obsidian-segmented"
        :class="{ 'is-stretched': stretch }"
        role="radiogroup"
        :aria-label="label"
    >
        <button
            v-for="option in options"
            :key="option.value"
            type="button"
            role="radio"
            :aria-checked="modelValue === option.value"
            :disabled="disabled || option.disabled"
            @click="select(option.value)"
        >
            <ObsidianIcon v-if="option.icon" :name="option.icon" />
            <span>{{ option.label }}</span>
        </button>
    </div>
</template>

<style scoped>
.journalyst-obsidian-segmented {
    display: inline-grid;
    max-width: 100%;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    align-items: stretch;
    padding: var(--size-2-1);
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--journalyst-base-recessed);
}

.journalyst-obsidian-segmented.is-stretched {
    display: grid;
    width: 100%;
}

.journalyst-obsidian-segmented button {
    display: inline-flex;
    width: auto;
    min-width: 0;
    min-height: calc(var(--input-height) - var(--size-2-2));
    align-items: center;
    justify-content: center;
    gap: var(--size-4-2);
    padding: 0 var(--size-4-3);
    border: 0;
    border-radius: calc(var(--radius-s) - 1px);
    background: transparent;
    box-shadow: none;
    color: var(--text-muted);
}

.journalyst-obsidian-segmented button:hover:not(:disabled) {
    background: var(--interactive-hover);
    color: var(--text-normal);
}

.journalyst-obsidian-segmented button[aria-checked='true'] {
    background: var(--journalyst-accent-dark);
    color: var(--text-on-accent);
}

.journalyst-obsidian-segmented button:focus-visible {
    outline: var(--border-width) solid var(--background-modifier-border-focus);
    outline-offset: var(--size-2-1);
}
</style>
