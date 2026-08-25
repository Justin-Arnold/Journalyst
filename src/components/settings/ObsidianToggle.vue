<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ToggleComponent } from 'obsidian';

const props = withDefaults(defineProps<{
    modelValue: boolean;
    disabled?: boolean;
    label: string;
}>(), {
    disabled: false,
});

const emit = defineEmits<{
    'update:modelValue': [value: boolean];
}>();

const root = ref<HTMLElement | null>(null);
let toggle: ToggleComponent | null = null;

function syncToggle() {
    if (!toggle) return;
    toggle.setValue(props.modelValue).setDisabled(props.disabled);
    toggle.toggleEl.setAttr('aria-label', props.label);
}

onMounted(() => {
    if (!root.value) return;
    toggle = new ToggleComponent(root.value)
        .setValue(props.modelValue)
        .setDisabled(props.disabled)
        .onChange(value => emit('update:modelValue', value));
    syncToggle();
});

watch(
    () => [props.modelValue, props.disabled, props.label] as const,
    () => void nextTick(syncToggle),
);

onBeforeUnmount(() => {
    root.value?.replaceChildren();
    toggle = null;
});
</script>

<template>
    <span ref="root" class="journalyst-obsidian-toggle" />
</template>
