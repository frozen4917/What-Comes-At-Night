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

// Get the version from package.json, used for footer of menu
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
                <!-- SAVE FILE DETECTED: Continue game -->
                <button v-if="gameStore.hasSaveFile" class="menu-button" @click="gameStore.continueSavedGame()">
                    Continue Night
                </button>
                <!-- Start new game (overrides save file) -->
                <button class="menu-button primary" @click="gameStore.launchNewGame()">
                    Start New Game
                </button>
                <!-- How to play overlay -->
                <button class="menu-button primary" @click="gameStore.toggleHowToPlay()">
                    How to Play
                </button>
            </div>
            <!-- Version footer -->
            <div class="menu-footer">
                v{{ appVersion }} (In development)
            </div>

            <a href="https://github.com/frozen4917/what-comes-at-night/" target="_blank" rel="noopener noreferrer" class="icon-link"
                    title="Source Code on GitHub">
                    <div class="github-icon"></div>
            </a>
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

/* GITHUB ICON BUTTON */

/* Style for the GitHub icon link */
.icon-link {
    display: block;
    width: 3.6rem;
    height: 3.6rem;
    margin: 1rem auto 0; /* Center the icon */
    transition: filter 0.15s ease;
}

.icon-link:hover {
    filter: brightness(1.5);  /* Simple, clean hover effect */
}

.github-icon {
    width: 100%;
    height: 100%;

    background-color: #b91c1c; /* Fixed colour */
    mask-image: url(/icons/github.svg);
    mask-size: contain;
    mask-repeat: no-repeat;
    mask-position: center;

    -webkit-mask-image: url(/icons/github.svg);
    -webkit-mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    -webkit-mask-position: center;
}
</style>