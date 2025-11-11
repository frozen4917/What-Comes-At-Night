<script setup>
import { computed } from 'vue';
import { useGameStore } from '@/stores/gameStore';

const gameStore = useGameStore();

// This computed property finds the correct final icon URL
const finalPhaseIconUrl = computed(() => {
    if (!gameStore.gameState.world.currentPhaseId) return 'none';
    let phaseId = gameStore.gameState.world.currentPhaseId === 'dawn'
        ? 'dawn'
        : gameStore.gameState.world.currentPhaseId;
    return `url(/icons/${phaseId}.png)`;
});

// This computed property finds the full phase name
const phaseName = computed(() => {
    if (!gameStore.gameData || !gameStore.gameState.world.currentPhaseId) return '';
    const phaseId = gameStore.gameState.world.currentPhaseId;
    const phaseData = gameStore.gameData.phases.phases.find(p => p.id === phaseId);
    return phaseData ? phaseData.name : phaseId;
});

// We'll split the final prompt text into paragraphs for cleaner rendering
const finalParagraphs = computed(() => {
    if (!gameStore.promptText) return [];
    return gameStore.promptText.split('\n\n');
});
</script>

<template>
    <div id="end-game-overlay" class="overlay">

        <div class="end-game-content">

            <div class="end-game-icon"
                :style="{ maskImage: finalPhaseIconUrl, '-webkit-mask-image': finalPhaseIconUrl }" :title="phaseName">
            </div>

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
    justify-content: center;
    align-items: flex-start; /* Align to top */
    overflow-y: auto;
    padding-top: 5rem;
}

.end-game-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 90%;
    max-width: 100rem;
    font-family: 'Special Elite', monospace;
    font-size: 1.8rem;
    line-height: 1.8;
    margin: 0;
    padding-bottom: 15rem;
}

.end-game-content p {
    text-align: left;
    width: 100%;
}

.end-game-icon {
    background-color: var(--accent-color);
    mask-image: var(--icon-url);
    mask-size: contain;
    mask-repeat: no-repeat;
    mask-position: center;

    -webkit-mask-image: var(--icon-url);
    -webkit-mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    -webkit-mask-position: center;

    width: 10rem;
    height: 10rem; 
    margin-bottom: 4rem; 
    flex-shrink: 0;
}
</style>