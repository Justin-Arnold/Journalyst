<script setup lang="ts">
import ObsidianIcon from './ObsidianIcon.vue';

type AlertCardTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error';
type AlertCardDensity = 'comfortable' | 'compact';

withDefaults(defineProps<{
    tone?: AlertCardTone;
    density?: AlertCardDensity;
    icon: string;
    iconClass?: string;
    title?: string;
    description?: string;
    role?: 'status' | 'alert';
    ariaLive?: 'off' | 'polite' | 'assertive';
}>(), {
    tone: 'neutral',
    density: 'comfortable',
    iconClass: '',
    title: '',
    description: '',
    role: undefined,
    ariaLive: undefined,
});
</script>

<template>
    <div class="journalyst-alert-card-container">
        <article
            class="journalyst-alert-card"
            :class="[`is-${tone}`, `is-${density}`]"
            :role="role"
            :aria-live="ariaLive"
        >
            <span class="journalyst-alert-card-icon">
                <ObsidianIcon :name="icon" :class="iconClass" />
            </span>
            <div class="journalyst-alert-card-copy">
                <strong v-if="title">{{ title }}</strong>
                <p v-if="description">{{ description }}</p>
                <slot />
            </div>
            <div v-if="$slots.actions" class="journalyst-alert-card-actions">
                <slot name="actions" />
            </div>
        </article>
    </div>
</template>

<style scoped>
.journalyst-alert-card-container {
    width: 100%;
    min-width: 0;
    container-type: inline-size;
}

.journalyst-alert-card {
    --journalyst-alert-color: var(--text-muted);
    display: grid;
    min-width: 0;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--size-4-4);
    border: var(--border-width) solid var(--background-modifier-border);
    border-left: 3px solid var(--journalyst-alert-color);
    border-radius: var(--radius-s);
    background: var(--journalyst-base-recessed);
}

.journalyst-alert-card.is-comfortable {
    padding: var(--size-4-4) var(--size-4-5);
}

.journalyst-alert-card.is-compact {
    gap: var(--size-4-3);
    padding: var(--size-4-3) var(--size-4-4);
}

.journalyst-alert-card.is-accent {
    --journalyst-alert-color: var(--text-accent);
}

.journalyst-alert-card.is-success {
    --journalyst-alert-color: var(--text-success);
}

.journalyst-alert-card.is-warning {
    --journalyst-alert-color: var(--text-warning);
}

.journalyst-alert-card.is-error {
    --journalyst-alert-color: var(--text-error);
}

.journalyst-alert-card-icon {
    display: inline-flex;
    width: 2rem;
    height: 2rem;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-s);
    background: var(--background-modifier-hover);
    color: var(--journalyst-alert-color);
}

.journalyst-alert-card.is-compact .journalyst-alert-card-icon {
    width: 1.75rem;
    height: 1.75rem;
}

.journalyst-alert-card-copy {
    min-width: 0;
}

.journalyst-alert-card-copy strong {
    display: block;
    color: var(--text-normal);
    font-size: var(--font-ui-small);
    overflow-wrap: anywhere;
}

.journalyst-alert-card-copy p {
    margin: var(--size-4-1) 0 0;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    overflow-wrap: anywhere;
}

.journalyst-alert-card-copy > :first-child {
    margin-top: 0;
}

.journalyst-alert-card-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--size-4-2);
    flex-wrap: wrap;
}

.journalyst-alert-card-actions :deep(button) {
    display: inline-flex;
    width: auto;
    min-height: var(--input-height);
    align-items: center;
    justify-content: center;
    gap: var(--size-4-2);
    padding: 0 var(--size-4-3);
    border: 0;
    background: transparent;
    box-shadow: none;
    color: var(--text-muted);
    white-space: nowrap;
}

.journalyst-alert-card-actions :deep(button:hover:not(:disabled)) {
    background: var(--interactive-hover);
    color: var(--text-normal);
}

.journalyst-alert-card-actions :deep(button:focus-visible) {
    outline: var(--border-width) solid var(--color-accent);
    outline-offset: var(--size-2-1);
}

@container (max-width: 36rem) {
    .journalyst-alert-card {
        grid-template-columns: auto minmax(0, 1fr);
        align-items: start;
    }

    .journalyst-alert-card-actions {
        grid-column: 2;
        justify-self: start;
        justify-content: flex-start;
    }
}
</style>
