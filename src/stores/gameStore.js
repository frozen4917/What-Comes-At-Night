import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

// --- Game Engine Imports ---
import { loadGameData } from '@/game/loader.js'
import { 
    initializeGameState,
    getCurrentActions,
    runPlayerTurn, 
    runMonsterTurn, 
    checkGameStatus 
} from '@/game/main.js'
import { buildPromptText } from '@/game/ui.js'
import { renderText } from '@/game/utils.js'

const SAVE_GAME_KEY = 'wcan_saveGame';

/**
 * This is the "Controller" (the brain) of your game.
 * It manages the reactive state and calls the "Engine" (your game logic).
 */
export const useGameStore = defineStore('game', () => {

    // --- STATE ---
    
    const gameData = ref(null);
    const gameState = ref({
        player: {},
        world: {},
        horde: {},
        status: {}
    });
    const validActions = ref([]);
    const promptText = ref("");

    // --- UI OVERLAY STATE ---
    
    const isInventoryOpen = ref(false);
    const isOptionsOpen = ref(false);
    const isGameOver = ref(false);

    // AUTO SAVE
    watch(gameState, (newGameState) => {
        // We stringify the object to save it as a string in localStorage.
        localStorage.setItem(SAVE_GAME_KEY, JSON.stringify(newGameState));
        console.log("Game state saved.");
    }, { deep: true });

    // --- INTERNAL HELPER FUNCTIONS ---

    /**
     * Updates the UI-facing refs (promptText and validActions) by calling the Engine.
     */
    function _updateUI() {
        if (!gameState.value || !gameData.value) return;

        // Get new text from the engine
        promptText.value = buildPromptText(gameState.value, gameData.value);
        
        // Get new actions from the engine
        validActions.value = getCurrentActions(gameState.value, gameData.value);
    }

    /**
     * Replicates the logic from your original endGame() function to build the final win/loss text.
     */
    function _buildEndGameText(outcome) {
        const finalMessages = [];

        // 1. Get any leftover messages from the queue
        if (gameState.value.status.messageQueue && gameState.value.status.messageQueue.length > 0) {
            for (const messageObject of gameState.value.status.messageQueue) {
                const template = gameData.value.texts[messageObject.text_ref];
                if (template) {
                    finalMessages.push(renderText(template, messageObject.params));
                }
            }
        }
        
        // 2. Add the specific win/loss text
        if (outcome === 'lose') {
            finalMessages.push(gameData.value.texts.game_over_lose);
        } else if (outcome === 'win') {
            finalMessages.push(gameData.value.texts.phase_intro_dawn);

            const totalMonsters = Object.values(gameState.value.horde).reduce((sum, list) => sum + list.length, 0);
            if (totalMonsters > 0) {
                finalMessages.push(gameData.value.texts.game_over_win_monsters);
            }
            if (gameState.value.player.health <= 15) {
                finalMessages.push(gameData.value.texts.game_over_win_critical);
            } else {
                finalMessages.push(gameData.value.texts.game_over_win_normal);
            }
        }
        
        // 3. Join it all together
        return finalMessages.join('\n\n'); // Use newlines for final display
    }

    // --- CORE GAME FUNCTIONS ---

    /**
     * Called one time by App.vue when the game loads.
     */
    async function startGame() {
        console.log("Game Store: startGame() called")
        try {
            // 1. Load all game data (the "Rulebook")
            gameData.value = await loadGameData();
            
            // 2. Initialize the game state (the "Game Board")
            // Check for saved game. 
            const savedGame = localStorage.getItem(SAVE_GAME_KEY);
            
            if (savedGame) {
                // If a save exists, load it
                console.log("Game Store: Found saved game, loading...");
                gameState.value = JSON.parse(savedGame);
            } else {
                // If no save, initialize a fresh game
                console.log("Game Store: No saved game, initializing new game...");
                gameState.value = initializeGameState(gameData.value);
                
                // Only run the monster turn on a *brand new* game
                runMonsterTurn(gameState.value, gameData.value);
            }

            // 3. Update the UI with initial text and actions
            _updateUI();

        } catch (error) {
            console.error("Game Store: Failed to start game", error);
            promptText.value = "FATAL ERROR: Could not start game. Check console for details.";
        }
    }

    /**
     * This is the main game loop, called by the UI every time the player clicks an action button.
     */
    function handlePlayerAction(chosenAction) {
        if (isGameOver.value) return; // Don't do anything if the game is over
        
        console.log("Player chose:", chosenAction.id); // For debugging
        
        // 1. Run the Player's turn (handles effects, damage, clock)
        runPlayerTurn(chosenAction, gameState.value, gameData.value);
        
        // 2. Check for win/loss/phase change
        const status = checkGameStatus(gameState.value, gameData.value);

        // 3. Handle the result (Controller logic)
        if (status.isGameOver) {
            isGameOver.value = true;
            promptText.value = _buildEndGameText(status.outcome);

            localStorage.removeItem(SAVE_GAME_KEY);
            console.log("Game over, save file deleted.");
        } else {
            // Run monster's turn (spawning/despawning, fortification damage)
            runMonsterTurn(gameState.value, gameData.value);
            // 5. Update the UI for the next turn
            _updateUI();
        }
    }


    // --- UI HELPER FUNCTIONS ---

    function toggleInventory() {
        isInventoryOpen.value = !isInventoryOpen.value;
    }

    function toggleOptions() {
        isOptionsOpen.value = !isOptionsOpen.value;
    }

    function restartGame() {
        console.log("Restarting game, deleting save...");
        // 1. Delete the save file
        localStorage.removeItem(SAVE_GAME_KEY);
        // 2. Reload the page
        location.reload();
    };


    // --- This exposes our state and functions to the components ---
    return {
        // State
        gameState,
        gameData,
        validActions,
        promptText,
        isInventoryOpen,
        isOptionsOpen,
        isGameOver,

        // Functions
        startGame,
        handlePlayerAction,
        toggleInventory,
        toggleOptions,
        restartGame
    };
})