<script setup>
import { computed } from 'vue';
import { useGameStore } from '@/stores/gameStore';

// Get a reactive reference to our game store
const gameStore = useGameStore();

// This computed property splits the single prompt string into an array
// of paragraphs, using the \n\n separator from buildPromptText.
const paragraphs = computed(() => {
    if (!gameStore.promptText) {
        return [];
    }
    return gameStore.promptText.split('\n\n');
});
</script>

<template>
    <main id="content-display">
        <p v-for="(p, index) in paragraphs" :key="index">
            {{ p }}
        </p>
    </main>
</template>

<style scoped>
/* This style makes sure that paragraphs are rendered correctly,
  even if the promptText string is empty.
*/
#content-display {
    display: block;
}

/* This rule will respect newlines (\n) in your threat text */
p {
    white-space: pre-line;
}
</style>