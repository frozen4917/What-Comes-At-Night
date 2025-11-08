<script setup>
import { computed } from 'vue';
import { useGameStore } from '@/stores/gameStore';

const gameStore = useGameStore();

const finalParagraphs = computed(() => {
    if (!gameStore.promptText) {
        return [];
    }
    return gameStore.promptText.split('\n\n');
});
</script>

<template>
    <div id="end-game-overlay" class="overlay">
        <div class="end-game-content">

            <p v-for="(p, index) in finalParagraphs" :key="index">
                {{ p }}
            </p>

            <button class="end-game-button" @click="gameStore.restartGame()">
                Start New Game
            </button>
        </div>
    </div>
</template>

<style scoped>
.overlay {
    display: flex;
    overflow-y: auto;
    padding: 5vh 20px;
}

.end-game-content {
    /* This will center the button */
    text-align: center;
}

.end-game-content p {
    /* This keeps your story text aligned left */
    text-align: left;
}

/* FIX 2: Force scrollbar styles to apply to this component
*/
.overlay::-webkit-scrollbar {
    width: 8px;
}

.overlay::-webkit-scrollbar-track {
    background: #222;
    /* Visible dark grey */
}

.overlay::-webkit-scrollbar-thumb {
    background: var(--accent-color);
    border-radius: 0;
}

.overlay::-webkit-scrollbar-thumb:hover {
    filter: brightness(1.2);
}
</style>