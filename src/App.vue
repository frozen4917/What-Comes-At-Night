<script setup>
import { onMounted, computed } from 'vue';
import { useGameStore } from './stores/gameStore';
import { unlockAudio } from './game/audioService';

// 1. Import all our components
import StatsBar from './components/layout/StatsBar.vue';
import ContentDisplay from './components/layout/ContentDisplay.vue';
import ActionMenu from './components/layout/ActionMenu.vue';
import GameFooter from './components/layout/GameFooter.vue';

import InventoryOverlay from './components/overlays/InventoryOverlay.vue';
import OptionsOverlay from './components/overlays/OptionsOverlay.vue';
import EndGameOverlay from './components/overlays/EndGameOverlay.vue';
import RestartConfirmationOverlay from './components/overlays/RestartConfirmationOverlay.vue';

// 2. Initialize the game store (our "Controller")
const gameStore = useGameStore();

// 3. Call startGame() once the component is mounted (loaded)
onMounted(() => {
    gameStore.startGame();
});

// 4. Create a computed property for the dynamic theme
const themeClass = computed(() => {
    if (!gameStore.gameState || !gameStore.gameState.world) {
        return 'theme-dusk'; // Default theme
    }
    // This will return 'theme-dusk', 'theme-nightfall', etc.
    return `theme-${gameStore.gameState.world.currentPhaseId}`;
});
</script>

<template>
    <div id="app" :class="themeClass" @click.once="unlockAudio">

        <EndGameOverlay v-if="gameStore.isGameOver" />

        <template v-else>

            <StatsBar />
            <ContentDisplay />
            <ActionMenu />
            <GameFooter />

            <InventoryOverlay v-if="gameStore.isInventoryOpen" />
            <OptionsOverlay v-if="gameStore.isOptionsOpen" />
            <RestartConfirmationOverlay v-if="gameStore.isRestartConfirmOpen" />

        </template>
    </div>
</template>

<style>
@import './assets/main.css';
</style>