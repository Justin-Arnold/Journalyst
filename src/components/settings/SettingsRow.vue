<script setup lang="ts">
withDefaults(defineProps<{
    title: string;
    description?: string;
    disabled?: boolean;
}>(), {
    description: '',
    disabled: false,
});
</script>

<template>
    <div class="setting-item journalyst-settings-row" :class="{ 'is-disabled': disabled }">
        <div class="setting-item-info journalyst-settings-row-copy">
            <h3 class="setting-item-name journalyst-type-row-title">{{ title }}</h3>
            <div v-if="description" class="setting-item-description journalyst-type-supporting">{{ description }}</div>
            <slot name="detail" />
        </div>
        <div class="setting-item-control journalyst-settings-row-controls">
            <slot />
        </div>
    </div>
</template>

<style scoped>
.journalyst-settings-row {
    display: grid;
    min-width: 0;
    grid-template-columns: minmax(12rem, 1fr) minmax(14rem, auto);
    align-items: center;
    gap: var(--size-4-6);
    padding: var(--size-4-4);
}

.journalyst-settings-row + .journalyst-settings-row {
    border-top: var(--border-width) solid var(--background-modifier-border);
}

.journalyst-settings-row-copy,
.journalyst-settings-row-controls {
    min-width: 0;
}

.journalyst-settings-row-copy .setting-item-name {
    display: block;
    margin: 0;
    color: var(--text-normal);
}

.journalyst-settings-row-copy .setting-item-description {
    margin: var(--size-4-1) 0 0;
    color: var(--text-muted);
}

.journalyst-settings-row-controls {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--size-4-2);
    flex-wrap: wrap;
}

.journalyst-settings-row-controls :deep(button) {
    display: inline-flex;
    width: auto;
    align-items: center;
    justify-content: center;
    gap: var(--size-4-2);
}

.journalyst-settings-row-controls :deep(select) {
    width: min(18rem, 100%);
}

.journalyst-settings-row.is-disabled {
    color: var(--text-faint);
}

@container (max-width: 38rem) {
    .journalyst-settings-row {
        grid-template-columns: minmax(0, 1fr);
        align-items: start;
        gap: var(--size-4-3);
    }

    .journalyst-settings-row-controls {
        justify-content: flex-start;
    }
}
</style>
