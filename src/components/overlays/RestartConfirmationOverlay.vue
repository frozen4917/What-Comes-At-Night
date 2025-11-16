<script setup>
import { useGameStore } from '@/stores/gameStore';
const gameStore = useGameStore();
</script>

<template>
    <div id="restart-confirm-overlay" class="overlay">
        <div class="overlay-content">
            <h2 class="confirm-title">Restart Game?</h2>

            <p class="confirm-text">
                Are you sure you want to restart?
                Your current progress will be lost.
            </p>

            <div class="modal-button-group">
                <button class="modal-button confirm" @click="gameStore.restartGame()">
                    Yes, Restart
                </button>

                <button class="modal-button" @click="gameStore.toggleRestartConfirm()">
                    No, Cancel
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* These styles are consistent with your other overlays */
.overlay {
    display: flex;
    justify-content: center;
    align-items: center;
}

.overlay-content {
    font-family: 'Special Elite', monospace;
}

/* Specific styles for this component */
.confirm-title {
    font-family: 'Roboto Condensed', sans-serif;
    text-transform: uppercase;
    color: var(--accent-color);
    margin-top: 0;
    margin-bottom: 1.5rem;
    text-align: center;
}

.confirm-text {
    font-size: 1.6rem;
    line-height: 1.6;
    text-align: center;
    white-space: pre-line;
    /* Allows newlines */
    margin: 0 0 2.5rem 0;
}
</style>