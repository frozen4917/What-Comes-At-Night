<script setup>
/**
 * @component ContentDisplay
 * @description Main text display area for game story and events
 * Renders the current game prompt, which includes:
 * - Phase flavor text (e.g., "The sun bleeds orange...")
 * - Location descriptions (first visit, return, staying)
 * - Action consequences (crafted item, dealt damage, etc.)
 * - Threat messages (horde spawns, attacks, etc.)
 * - Status warnings (low health/stamina alerts)
 */

import { computed } from 'vue';
import { useGameStore } from '@/stores/gameStore';

const gameStore = useGameStore();

// --- COMPUTED PROPERTIES ---

/**
 * Splits the prompt string into individual paragraphs. The engine uses '\n\n' as paragraph separator.
 * Each paragraph is rendered as a separate <p> tag for proper spacing. Returns empty array if no text available.
 */
const paragraphs = computed(() => {
    if (!gameStore.promptText) {
        return [];
    }
    return gameStore.promptText.split('\n\n');
});
</script>

<template>
    <main id="content-display">
        <!-- Each paragraph rendered separately for proper formatting -->
        <p v-for="(p, index) in paragraphs" :key="index">
            {{ p }}
        </p>
    </main>
</template>

<style scoped>
/* Ensures proper rendering even with empty prompt. Block display is required for scrolling behavior. */
#content-display {
    display: block;
}

/* Respects line breaks (\n) within individual paragraphs. */
p {
    white-space: pre-line;
}
</style>