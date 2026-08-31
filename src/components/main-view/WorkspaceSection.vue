<script setup lang="ts">
defineProps<{
    title: string;
    description?: string;
}>();
</script>

<template>
    <section class="journalyst-review-section">
        <div class="journalyst-section-heading">
            <h2 class="journalyst-type-section-title">{{ title }}</h2>
            <p v-if="description" class="journalyst-review-section-description journalyst-type-supporting">{{ description }}</p>
        </div>
        <slot />
    </section>
</template>
