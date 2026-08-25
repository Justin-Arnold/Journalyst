<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
    variant?: 'default' | 'cta' | 'warning' | 'destructive';
    type?: 'button' | 'submit' | 'reset';
}>(), {
    variant: 'default',
    type: 'button',
});

const variantClass = computed(() => props.variant === 'default' ? undefined : `mod-${props.variant}`);
</script>

<template>
    <button :type="type" :class="variantClass">
        <slot />
    </button>
</template>
