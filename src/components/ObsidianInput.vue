<script setup lang="ts">
import { computed } from 'vue';

defineOptions({ inheritAttrs: false });

type InputValue = string | number | null;

const props = withDefaults(defineProps<{
    modelValue?: InputValue;
    value?: InputValue;
    type?: 'date' | 'email' | 'number' | 'password' | 'search' | 'text' | 'time';
}>(), {
    modelValue: undefined,
    value: '',
    type: 'text',
});

const emit = defineEmits<{
    'update:modelValue': [value: string];
    input: [event: Event];
    change: [event: Event];
}>();

const inputValue = computed(() => props.modelValue === undefined ? props.value ?? '' : props.modelValue);

function handleInput(event: Event) {
    emit('update:modelValue', (event.target as HTMLInputElement).value);
    emit('input', event);
}
</script>

<template>
    <input
        v-bind="$attrs"
        class="journalyst-obsidian-input journalyst-type-control"
        :type="type"
        :value="inputValue"
        @input="handleInput"
        @change="emit('change', $event)"
    >
</template>

<style scoped>
.journalyst-obsidian-input {
    min-width: 0;
    max-width: 100%;
    height: var(--input-height);
    box-sizing: border-box;
    padding: var(--input-padding);
    border: var(--input-border-width) solid var(--background-modifier-border);
    border-radius: var(--input-radius);
    background: var(--background-modifier-form-field);
    color: var(--text-normal);
    outline: none;
}

.journalyst-obsidian-input:not(:disabled):hover {
    border-color: var(--background-modifier-border-hover);
    background-color: var(--background-modifier-form-field-hover);
}

.journalyst-obsidian-input:focus,
.journalyst-obsidian-input:focus-visible {
    border-color: var(--background-modifier-border-focus);
    box-shadow: 0 0 0 var(--input-border-width-focus) var(--background-modifier-border-focus);
}

.journalyst-obsidian-input:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}

.journalyst-obsidian-input::placeholder {
    color: var(--input-placeholder-color);
}
</style>
