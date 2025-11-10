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
/* THIS IS THE LAYOUT FIX
*/
.overlay {
    /* Use display: flex to enable centering */
    display: flex;
    justify-content: center;
    align-items: flex-start;
    
    /* Make the *overlay itself* scrollable */
    overflow-y: auto;
    padding-top: 5vh;
}

.end-game-content {
    /* Use flex to center its children (icon, button) */
    display: flex;
    flex-direction: column;
    align-items: center;

    /* Sizing */
    width: 90%;
    max-width: 1000px;
    padding: 0 20px;  /* Add horizontal padding here instead */
    box-sizing: border-box;  /* Ensure padding is included in width */

    /* Text styles */
    font-family: 'Special Elite', monospace;
    font-size: 1.3em;
    line-height: 1.8;
    margin: 0;

    padding-bottom: 20vh;
}

.end-game-content p {
    /* This ensures all paragraphs inside the end game screen
     are left-aligned, but the icon/button can be centered. */
    text-align: left;
    width: 100%;
}

/* This is the icon style */
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

    width: 100px;
    height: 100px;
    margin-bottom: 40px;
    flex-shrink: 0;
}

/* This forces the scrollbar to be visible */
.overlay::-webkit-scrollbar {
    width: 8px;
}

.overlay::-webkit-scrollbar-track {
    background: #222;
}

.overlay::-webkit-scrollbar-thumb {
    background: var(--accent-color);
    border-radius: 0;
}

.overlay::-webkit-scrollbar-thumb:hover {
    filter: brightness(1.2);
}
</style>