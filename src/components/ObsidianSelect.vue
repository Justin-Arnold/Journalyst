<script setup lang="ts">
import { computed } from 'vue';

defineOptions({ inheritAttrs: false });

type SelectValue = string | number | null;

const props = withDefaults(defineProps<{
    modelValue?: SelectValue;
    value?: SelectValue;
}>(), {
    modelValue: undefined,
    value: '',
});

const emit = defineEmits<{
    'update:modelValue': [value: SelectValue];
    change: [event: Event];
}>();

const selectedValue = computed({
    get: () => props.modelValue === undefined ? props.value ?? '' : props.modelValue,
    set: value => emit('update:modelValue', value),
});
</script>

<template>
    <select
        v-model="selectedValue"
        v-bind="$attrs"
        class="dropdown journalyst-obsidian-select"
        @change="emit('change', $event)"
    >
        <slot />
    </select>
</template>

<style scoped>
.journalyst-obsidian-select {
    min-width: 0;
    max-width: 100%;
}
</style>
