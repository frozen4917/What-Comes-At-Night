<script setup>
/**
 * @component OptionsOverlay
 * @description Settings and information modal
 * Provides access to:
 * - Volume control (0-100% slider)
 * - How to Play instructions
 * - External links (GitHub repository)
 */
import { useGameStore } from '@/stores/gameStore';

const gameStore = useGameStore();

// --- FUNCTIONS ---

/**
 * Handles volume slider changes.
 * Passes new value to store which:
 * 1. Updates reactive volume state (for slider position)
 * 2. Calls audioService to set actual audio volume
 * 3. Saves preference to localStorage
 * @param {Event} event - Input event from range slider
 */
function onVolumeChange(event) {
    gameStore.updateVolume(event.target.value);
}
</script>

<template>
    <div id="options-overlay" class="overlay">
        <div class="overlay-content">
            <h2>Options</h2>
            <!-- VOLUME CONTROL -->
            <div class="option-item">
                <label for="volume">Volume: {{ gameStore.volume }}%</label>
                <!-- Range slider (0-100, mapped internally to 0-0.3 actual volume) -->
                <input type="range" id="volume" min="0" max="100" :value="gameStore.volume" @input="onVolumeChange"
                    class="volume-slider" />
            </div>
            <!-- HOW TO PLAY -->
            <div class="option-item">
                <h3>How to Play</h3>
                <p class="how-to-play">
                    > The night is long. Survive for 50 moves until the sun rises.
                </p>
                <p class="how-to-play">
                    > Explore and gather resources. Fortify your base and maintain your HP and Stamina.
                </p>
                <p class="how-to-play">
                    > Actions require Stamina and create Noise. Keep Noise low to avoid unwanted attention.
                </p>
                <p class="how-to-play">
                    > What comes at night... must be fought.
                </p>
            </div>
            <!-- EXTERNAL LINKS -->
            <div class="option-item">
                <h3>Links</h3>
                <!-- GitHub icon link (uses CSS mask for theme coloring) -->
                <a href="https://github.com/frozen4917/what-comes-at-night/" target="_blank" rel="noopener noreferrer" class="icon-link"
                    title="Source Code on GitHub">
                    <div class="github-icon"></div>
                </a>
            </div>
            <!-- CLOSE BUTTON -->
            <button class="footer-button close-button" @click="gameStore.toggleOptions()">
                Close
            </button>
        </div>
    </div>
</template>

<style scoped>
.overlay {
    display: flex;
    justify-content: center;
    align-items: center;
}

.overlay-content {
    font-family: 'Special Elite', monospace;
    max-height: 60rem;
    overflow-y: auto;
    padding-right: 2rem;
}

/* Spacing for each settings section */
.option-item {
    margin-bottom: 2.5rem;
}

/* Section headers styled consistently. Uppercase + accent color matches game aesthetic. */
.option-item h3 {
    text-transform: uppercase;
    font-family: 'Roboto Condensed', sans-serif;
    color: var(--accent-color);
    margin-top: 0;
    margin-bottom: 1rem;
    text-align: center;
}

.option-item h2 {
    text-align: center;
}

/* Volume Slider Label */
.option-item label {
    font-family: 'Special Elite', monospace; /* Use UI font for label */
    text-transform: uppercase;
    font-size: 1.6rem;
    display: block;
    margin-bottom: 1rem;
    text-align: center;
}

.option-item p {
    margin: 0;
    line-height: 1.6;
    /* Center paragraph text */
}

/* Text formatting for How-to-play */
.how-to-play {
    font-size: 1.6rem;
    text-align: left;
    white-space: pre-line;
}

/* Style for the GitHub icon link */
.icon-link {
    display: block;
    width: 4.8rem;
    height: 4.8rem;
    margin: 1rem auto 0; /* Center the icon */
    transition: filter 0.15s ease;
}

.icon-link:hover {
    filter: brightness(1.5);  /* Simple, clean hover effect */
}

/**
 * GitHub icon using CSS mask technique. Same approach as phase icons - SVG masked by theme color.
 * This allows the icon to adapt to any theme without multiple assets.
 */
.github-icon {
    width: 100%;
    height: 100%;

    background-color: var(--accent-color);
    mask-image: url(/icons/github.svg);
    mask-size: contain;
    mask-repeat: no-repeat;
    mask-position: center;

    -webkit-mask-image: url(/icons/github.svg);
    -webkit-mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    -webkit-mask-position: center;
}

.close-button {
    display: block;
    margin: 2rem auto 0;
    text-align: center;
}


/* VOLUME SLIDER */
.volume-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 0.4rem;
    background: #222; /* Dark track */
    outline: none;
    cursor: pointer;
}

.volume-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    border-radius: 0; /* Sharp rectangle */
    width: 1.2rem;
    height: 2.4rem;
    background: var(--accent-color);
    transition: background 0.15s ease;
}

.volume-slider::-webkit-slider-thumb:hover {
    filter: brightness(1.2);
}

/* Firefox-specific slider thumb styling. Same appearance as WebKit version for consistency. */
.volume-slider::-moz-range-thumb {
    border-radius: 0;
    border: none;
    width: 1.2rem;
    height: 2.4rem;
    background: var(--accent-color);
    transition: background 0.15s ease;
}

.volume-slider::-moz-range-thumb:hover {
    filter: brightness(1.2);
}

.volume-slider::-moz-range-track {
    width: 100%;
    height: 0.4rem;
    background: #222;
}
</style>