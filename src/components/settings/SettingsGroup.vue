<script setup lang="ts">
import ObsidianIcon from '../ObsidianIcon.vue';
import type { SettingsStatusTone } from './types';

withDefaults(defineProps<{
    title: string;
    description?: string;
    icon: string;
    status?: string;
    statusTone?: SettingsStatusTone;
}>(), {
    description: '',
    status: '',
    statusTone: 'neutral',
});
</script>

<template>
    <section class="journalyst-settings-group">
        <header class="journalyst-settings-group-header">
            <span class="journalyst-settings-group-title">
                <ObsidianIcon :name="icon" />
                <span>
                    <strong>{{ title }}</strong>
                    <small v-if="description">{{ description }}</small>
                </span>
            </span>
            <span
                v-if="status"
                class="journalyst-settings-group-status"
                :class="`is-${statusTone}`"
            >
                {{ status }}
            </span>
            <div v-if="$slots.actions" class="setting-item-control journalyst-settings-group-actions">
                <slot name="actions" />
            </div>
        </header>
        <div class="journalyst-settings-group-body">
            <slot />
        </div>
    </section>
</template>

<style scoped>
.journalyst-settings-group {
    overflow: hidden;
    border: var(--border-width) solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    background: var(--background-primary);
    container-type: inline-size;
}

.journalyst-settings-group-header,
.journalyst-settings-group-title,
.journalyst-settings-group-actions {
    display: flex;
    align-items: center;
}

.journalyst-settings-group-header {
    min-height: 3rem;
    gap: var(--size-4-3);
    padding: var(--size-4-3) var(--size-4-4);
    border-bottom: var(--border-width) solid var(--background-modifier-border);
    background: var(--journalyst-base-recessed);
}

.journalyst-settings-group-title {
    min-width: 0;
    flex: 1 1 auto;
    gap: var(--size-4-3);
    color: var(--text-muted);
}

.journalyst-settings-group-title > :deep(.journalyst-icon) {
    flex: 0 0 auto;
}

.journalyst-settings-group-title > span {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: var(--size-2-1);
}

.journalyst-settings-group-title strong {
    color: var(--text-normal);
    font-size: var(--font-ui-small);
    font-weight: var(--font-semibold);
}

.journalyst-settings-group-title small {
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    line-height: 1.35;
}

.journalyst-settings-group-status {
    flex: 0 0 auto;
    padding: var(--size-2-1) var(--size-4-2);
    border-radius: var(--radius-s);
    background: var(--background-modifier-hover);
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    font-weight: var(--font-semibold);
    white-space: nowrap;
}

.journalyst-settings-group-status.is-accent {
    color: var(--text-accent);
}

.journalyst-settings-group-status.is-success {
    color: var(--text-success);
}

.journalyst-settings-group-status.is-warning {
    color: var(--text-warning);
}

.journalyst-settings-group-status.is-error {
    color: var(--text-error);
}

.journalyst-settings-group-actions {
    flex: 0 0 auto;
    gap: var(--size-4-2);
}

.journalyst-settings-group-actions :deep(button) {
    width: auto;
}

@container (max-width: 34rem) {
    .journalyst-settings-group-header {
        align-items: flex-start;
        flex-wrap: wrap;
    }

    .journalyst-settings-group-status {
        order: 2;
    }

    .journalyst-settings-group-actions {
        width: 100%;
        order: 3;
        padding-left: 1.75rem;
    }
}
</style>
