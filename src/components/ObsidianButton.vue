<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
    variant?: 'default' | 'cta' | 'warning' | 'destructive';
    type?: 'button' | 'submit' | 'reset';
}>(), {
    variant: 'default',
    type: 'button',
});

const buttonClasses = computed(() => [
    'journalyst-obsidian-button',
    `is-${props.variant}`,
    props.variant === 'default' ? null : `mod-${props.variant}`,
]);
</script>

<template>
    <button :type="type" :class="buttonClasses">
        <slot />
    </button>
</template>

<style scoped>
.journalyst-obsidian-button {
    display: inline-flex;
    width: auto;
    align-items: center;
    justify-content: center;
    gap: var(--size-4-2);
}

.journalyst-obsidian-button.is-default:hover:not(:disabled) {
    background-color: var(--interactive-hover);
    box-shadow: var(--input-shadow-hover);
}
</style>
