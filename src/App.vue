<script setup>
/**
 * @component App (Root Component)
 * @description Application entry point and layout manager
 * Responsibilities:
 * - Initializes game on mount (loads data, restores save, starts engine)
 * - Manages layout structure (stats, content, actions, footer)
 * - Controls overlay visibility (inventory, options, end game, etc.)
 * - Handles theme switching based on game phase
 * - Unlocks browser audio on first user interaction
 * 
 * Layout Structure:
 * ┌─────────────────────────────┐
 * │ StatsBar (HP, phase, etc.)  │
 * ├─────────────────────────────┤
 * │ ContentDisplay (text area)  │
 * ├─────────────────────────────┤
 * │ ActionMenu (choices)        │
 * ├─────────────────────────────┤
 * │ GameFooter (utilities)      │
 * └─────────────────────────────┘
 */

import { onMounted, computed } from 'vue';
import { useGameStore } from './stores/gameStore';
import { unlockAudio } from './game/audioService';

// --- COMPONENT IMPORTS ---

// Layout components (always visible during gameplay)
import StatsBar from './components/layout/StatsBar.vue';
import ContentDisplay from './components/layout/ContentDisplay.vue';
import ActionMenu from './components/layout/ActionMenu.vue';
import GameFooter from './components/layout/GameFooter.vue';

// Overlay components (shown conditionally via v-if)
import MainMenuOverlay from './components/overlays/MainMenuOverlay.vue';
import InventoryOverlay from './components/overlays/InventoryOverlay.vue';
import OptionsOverlay from './components/overlays/OptionsOverlay.vue';
import EndGameOverlay from './components/overlays/EndGameOverlay.vue';
import RestartConfirmationOverlay from './components/overlays/RestartConfirmationOverlay.vue';

// --- GAME STORE (CONTROLLER) ---

/**
 * Central state management store. Provides reactive game state and orchestrates game engine calls.
 */
const gameStore = useGameStore();

// --- LIFECYCLE ---

/**
 * Initialize game when component mounts.
 * This triggers:
 * 1. Loading all JSON data files
 * 2. Checking localStorage for saved game
 * 3. Either restoring save or creating new game state
 * 4. Running initial monster turn (if new game)
 * 5. Building initial UI (prompt text, action list)
 * 6. Starting phase music
 */
onMounted(() => {
    gameStore.startGame();
});

// --- COMPUTED PROPERTIES ---

/**
 * Dynamic theme class based on current game phase.
 * Maps phase IDs to CSS class names:, e.g. 'dusk' to 'theme-dusk', 'witching_hour' to 'theme-witching_hour', et.c
 * These classes are defined in global.css and change the --accent-color CSS variable, which cascades throughout the entire UI.
 * @returns {string} CSS class name for current phase theme
 */
const themeClass = computed(() => {
    if (!gameStore.gameState || !gameStore.gameState.world) {
        return ''; // Default root theme
    }
    if (gameStore.isGameStarted || gameStore.hasSaveFile) {
        return `theme-${gameStore.gameState.world.currentPhaseId}`;
    }
    // This will return 'theme-dusk', 'theme-nightfall', etc.
    return '';
});
</script>

<template>
    <!-- Root container with dynamic theme class and audio unlock handler. -->
    <!-- @click.once="unlockAudio" allows the browser to play audio upon first click, anywhere in the app. Only triggers once. -->
    <div id="app" :class="themeClass" @click.once="unlockAudio">

        <!-- MAIN MENU SCREEN if game hasn't started -->
        <MainMenuOverlay v-if="!gameStore.isGameStarted" />

        <!-- If game started, load the other elements -->
        <template v-else>

        <!-- GAME OVER STATE: Full-screen overlay with results -->
            <EndGameOverlay v-if="gameStore.isGameOver" />

            <!-- PLAYING STATE: Normal game layout + conditional overlays -->
            <template v-else>

                <!-- Main layout components (always visible during play) -->
                <StatsBar />
                <ContentDisplay />
                <ActionMenu />
                <GameFooter />

                <!-- Conditional overlays (shown based on store boolean flags) -->
                <!-- These are mounted/unmounted via v-if, not hidden with CSS -->
                <InventoryOverlay v-if="gameStore.isInventoryOpen" />
                <OptionsOverlay v-if="gameStore.isOptionsOpen" />
                <RestartConfirmationOverlay v-if="gameStore.isRestartConfirmOpen" />

            </template>
        </template>
    </div>
</template>

<style>
/* Import all application styles via main.css which acts as an aggregator */
@import './assets/main.css';
</style>