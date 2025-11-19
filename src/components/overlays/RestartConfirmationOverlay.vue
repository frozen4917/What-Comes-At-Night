<script setup>
/**
 * @component RestartConfirmationOverlay
 * @description Confirmation modal to prevent accidental game restarts
 * Shows a warning before restarting along with confirmation and cancel button
 */
import { useGameStore } from '@/stores/gameStore';
const gameStore = useGameStore();
</script>

<template>
    <div id="restart-confirm-overlay" class="overlay">
        <div class="overlay-content">
            <!-- Warning header -->
            <h2 class="confirm-title">Restart Game?</h2>
            <!-- Warning message -->
            <p class="confirm-text">
                Are you sure you want to restart?
                Your current progress will be lost.
            </p>
            <!-- Buttons (styled by components.css modal-button rule C5) -->
            <div class="modal-button-group">
                <!-- Confirm -->
                <button class="modal-button confirm" @click="gameStore.restartGame()">
                    Yes, Restart
                </button>
                <!-- Cancel -->
                <button class="modal-button" @click="gameStore.toggleRestartConfirm()">
                    No, Cancel
                </button>
            </div>
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
}

/* Title styling */
.confirm-title {
    font-family: 'Roboto Condensed', sans-serif;
    text-transform: uppercase;
    color: var(--accent-color);
    margin-top: 0;
    margin-bottom: 1.5rem;
    text-align: center;
}

/* Text styling */
.confirm-text {
    font-size: 1.6rem;
    line-height: 1.6;
    text-align: center;
    white-space: pre-line;
    margin: 0 0 2.5rem 0;
}
</style>