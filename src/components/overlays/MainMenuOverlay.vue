<script setup>
/**
 * @component MainMenuOverlay
 * @description Front page of the app
 * 
 * Displays details like:
 * - Game banner
 * - Start / Continue button
 * - How to play
 */
import { useGameStore } from '@/stores/gameStore';
const gameStore = useGameStore();

// Get the version from package.json
const appVersion = __APP_VERSION__;
</script>

<template>
    <div id="main-menu-overlay" class="overlay">
        <div class="menu-content">
            
            <!-- Top banner -->
            <div class="banner-container">
                <img src="/images/social-banner.png" alt="What Comes At Night" class="banner-image" />
            </div>

            <!-- Buttons -->
            <div class="menu-buttons">
                <button v-if="gameStore.hasSaveFile" class="menu-button" @click="gameStore.continueSavedGame()">
                    Continue Night
                </button>

                <button class="menu-button primary" @click="gameStore.launchNewGame()">
                    Start New Game
                </button>

                <button class="menu-button primary" @click="gameStore.toggleHowToPlay()">
                    How to Play
                </button>
            </div>

            <div class="menu-footer">
                v{{ appVersion }} (Development)
            </div>
        </div>
    </div>
</template>

<style scoped>
.overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: #000;
    z-index: 2000;
    display: flex;
    justify-content: center;
    align-items: center;
}

.menu-content {
    width: 100%;
    max-width: 600px;
    padding: 2rem;
    overflow-y: auto;
    text-align: center;
}

.banner-image {
    width: 100%;
    height: auto;
    display: block;
}

.menu-buttons {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    align-items: center;
}

.menu-footer {
    margin-top: 4rem;
    color: #444;
    font-family: 'Roboto Condensed', sans-serif;
    font-size: 1.2rem;
}
</style>