<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from "vue";
import { setIcon } from "obsidian";

const props = defineProps<{
    name: string;
}>();

const iconElement = ref<HTMLElement | null>(null);

function renderIcon() {
    const element = iconElement.value;
    if (!element) {
        return;
    }

    element.replaceChildren();
    setIcon(element, props.name);
}

onMounted(renderIcon);
watch(() => props.name, () => void nextTick(renderIcon));
</script>

<template>
    <span ref="iconElement" class="journalyst-icon" aria-hidden="true" />
</template>
