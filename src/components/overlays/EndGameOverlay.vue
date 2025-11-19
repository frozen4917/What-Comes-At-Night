<script setup>
/**
 * @component EndGameOverlay
 * @description Full-screen victory/defeat overlay with final narrative
 * Displays when the game ends (either by surviving until dawn or player death).
 * Shows the final game state including:
 * - Phase icon (dawn sunrise or current phase at death)
 * - Final narrative text
 * - "Start New Game" button to restart
 */

import { computed } from 'vue';
import { useGameStore } from '@/stores/gameStore';

const gameStore = useGameStore();

// --- COMPUTED PROPERTIES ---

/**
 * Retrieves the human-readable phase name (e.g., "Dusk", "Witching Hour").
 * @returns {string} Phase name
 */
const phaseName = computed(() => {
    if (!gameStore.gameData || !gameStore.gameState.world.currentPhaseId) return '';
    const phaseId = gameStore.gameState.world.currentPhaseId;
    const phaseData = gameStore.gameData.phases.phases.find(p => p.id === phaseId);
    return phaseData ? phaseData.name : phaseId;
});

/**
 * Constructs CSS url() for the phase icon image used in CSS mask-image property to create theme-colored icons, e.g. 'url(/icons/nightfall.png)'
 * The mask technique allows single icon assets to adapt to any theme color without needing multiple colored versions.
 * The icon visually reinforces the outcome without needing explicit text
 * @returns {string} CSS url() value or 'none' if phase not loaded
 */
const finalPhaseIconUrl = computed(() => {
    if (!gameStore.gameState.world.currentPhaseId) return 'none';
    let phaseId = gameStore.gameState.world.currentPhaseId === 'dawn'
        ? 'dawn'
        : gameStore.gameState.world.currentPhaseId;
    return `url(/icons/${phaseId}.png)`;
});


/**
 * Splits the final narrative text into paragraphs.
 * The engine assembles this from:
 * - Any remaining message queue items (actions, final attacks, etc.)
 * - Win/loss specific text from texts.json
 * - Health-based victory variations (critical vs normal)
 * @returns {string[]} Array of paragraph strings
 */
const finalParagraphs = computed(() => {
    if (!gameStore.promptText) return [];
    return gameStore.promptText.split('\n\n');
});
</script>

<template>
    <div id="end-game-overlay" class="overlay">

        <div class="end-game-content">
            <!-- Phase icon -->
            <div class="end-game-icon"
                :style="{ maskImage: finalPhaseIconUrl, '-webkit-mask-image': finalPhaseIconUrl }" :title="phaseName">
            </div>
            <!-- Final narrative paragraphs -->
            <p v-for="(p, index) in finalParagraphs" :key="index">
                {{ p }}
            </p>
            <!-- Start New Game button -->
            <button class="end-game-button" @click="gameStore.restartGame()">
                Start New Game
            </button>
        </div>
    </div>
</template>

<style scoped>
/**
 * Full-screen overlay that scrolls if content overflows.
 * Aligns content to top so long victory text doesn't push the icon off-screen on mobile.
 */
.overlay {
    display: flex;
    justify-content: center;
    align-items: flex-start; /* Top alignment for scrollable content */
    overflow-y: auto;
    padding-top: 5rem;
}

/* Content container */
.end-game-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 90%;
    max-width: 100rem;
    font-family: 'Special Elite', monospace; /* Same font from game story */
    font-size: 1.8rem;
    line-height: 1.8;
    margin: 0;
    padding-bottom: 15rem; /* Space for restart button + scrolling comfort */
}

.end-game-content p {
    text-align: left;
    width: 100%;
}

/**
 * Phase icon styling using CSS mask technique, same as in StatsBar
 */
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
    margin-bottom: 4rem; /* Create enough separation from text */
    flex-shrink: 0; /* Prevent icon from shrinking if content is tall */
}
</style>