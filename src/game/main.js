import promptSync from "prompt-sync";
import chalk from "chalk";
const prompt = promptSync({ sigint: true });

import { loadGameData } from './loader.js';
import { updateConsoleUI, buildPromptText } from './ui.js';
import { areConditionsMet, renderText } from './utils.js';
import { trapMonster, processFortificationDamage, processTimedEvents, processNoiseSpawning, processNoiseDespawning, processPlayerDamage } from "./monsterHandler.js";
import { handleEffects } from "./effectsHandler.js";


/**
 * Returns an array of all valid actions
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 * @returns {Object[]} Array of action objects
 */
export function getCurrentActions(gameState, gameData) {
    const validActions = [];
    const locationData = gameData.locations[gameState.world.currentLocation]; // Location specific data
    const globalData = gameData.globalActions; // Global options

    // Combined list of location-based and global actions
    const allMenuSources = [
        ...(locationData.menu || []),
        ...(globalData.menu || [])
    ];

    // Process all actions from both location and global files
    for (const category of allMenuSources) {
        for (const action of category.subActions) {
            // Check if the action's conditions (from showIf) are met by the current game state
            if (areConditionsMet(action.showIf, gameState, gameData)) {
                
                // Create the final action object and add it to the list
                validActions.push({
                    id: action.id,
                    displayText: gameData.texts[action.text_ref] || action.id, // Display text is the text shown on the option. Fallback to ID if text_ref is missing
                    effects: action.effects
                });
            }
        }
    }

    return validActions;
}

/**
 * Assembles gameState object from initialState.json and returns the new object
 * @param {Object} gameData Game-related data
 * @returns {Object} Assembled gameState object
 */
export function initializeGameState(gameData) {
    const initialState = gameData.initialState;

    // Step 1. Create the Player state
    const player = {
        ...initialState.player.initialStats,
        inventory: { ...initialState.player.initialInventory }
    };

    // Step 2. Create the World state
    const world = { ...initialState.world }; // Full copy
    world.flags = { ...initialState.world.flags }; // Deep copy flags
    world.fortifications = { ...initialState.world.fortifications }; // Deep copy fortifications
    world.traps = { ...initialState.world.traps }; // Deep copy traps
    world.visitedLocations = []; // Fresh arrays
    world.scavengedLocations = []; // Fresh arrays

    // Step 3. Find and set the actions for the first phase
    const firstPhaseData = gameData.phases.phases.find(p => p.id === world.currentPhaseId);
    if (!firstPhaseData) {
        console.error(chalk.red(`FATAL ERROR: Could not find phase data for initial phase ID: "${world.currentPhaseId}"`));
        process.exit(1);
    }
    world.actionsRemaining = firstPhaseData.durationInActions;

    // Step 4. Create Horde and Status (fresh copies)
    const horde = { ...initialState.horde };
    const status = { ...initialState.status };
    
    // Step 5. Assemble and return the complete gameState object
    return {
        player,
        world,
        horde,
        status
    };
}

/** 
 * Main entry point of the game
 */
async function startGame() {
    const gameData = await loadGameData(); // Get Game Data object
    
    const gameState = initializeGameState(gameData);
    
    runGameLoop(gameState, gameData);
}

/**
 * Decrements actions remaining, grace period cooldown, and repeated noise spawning cooldown
 * @param {Object} gameState Current dynamic game state
 */
function tickClock(gameState) {
    // Decrement actions remaining
    gameState.world.actionsRemaining -= 1;
    // Decrement grace period (spawn cooldown after kill)
    if (gameState.status.gracePeriodCooldown > 0) {
        gameState.status.gracePeriodCooldown -= 1;
    }
    // Decrement repeated spawn cooldown
    if (gameState.status.repeatedSpawnCooldown > 0) {
        gameState.status.repeatedSpawnCooldown -= 1;
    }
}

/**
 * Handles win/lose condition and triggers next phase
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 */
function checkGameStatus(gameState, gameData) {
    // Check player health. If below zero, trigger game lost condition
    if (gameState.player.health <= 0) {
        endGame('lose', gameState, gameData);
    }

    // If actionsRemaining is 0, trigger next phase
    if (gameState.world.actionsRemaining === 0) {
        // Find next phase
        const nextIndex = gameData.phases.phases.findIndex(phase => phase.id === gameState.world.currentPhaseId) + 1;

        // Update phase and actions remaining
        gameState.world.currentPhaseId = gameData.phases.phases[nextIndex].id
        gameState.world.actionsRemaining = gameData.phases.phases[nextIndex] ? gameData.phases.phases[nextIndex].durationInActions : -1;
    }

    // Check if phase is 'dawn'. If so, trigger game win condition
    if (gameState.world.currentPhaseId === 'dawn') {
        endGame('win', gameState, gameData);
    }
}

/**
 * Triggers end-game text and ends the game session
 * @param {"win" | "lose"} outcome Outcome of the game
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 */
function endGame(outcome, gameState, gameData) {
    prompt('Press Enter to continue to the next (mock) turn...');
    console.clear();

    // Step 1: Process consequence of last player action and monster threat messages if any
    const messageStrings = [];

    // Check for any messages in messageQueue
    if (gameState.status.messageQueue && gameState.status.messageQueue.length > 0) {
        // Loop through messageQueue to find each message
        for (const messageObject of gameState.status.messageQueue) {
            const template = gameData.texts[messageObject.text_ref];
            if (template) {
                // Render the text by replacing placeholders
                const renderedMessage = renderText(template, messageObject.params);
                messageStrings.push(renderedMessage); // Push the rendered text into the array
            }
        }
    }
    const consequenceAndThreatText = messageStrings.join('\n'); // Join the final consequence + threat text

    // Step 2: Process all relevant end-game messages
    const finalMessages = [];

    if (outcome === 'lose') {
        finalMessages.push(gameData.texts.game_over_lose); // Push the "lose" text
    } else if (outcome === 'win') {
        finalMessages.push(gameData.texts.phase_intro_dawn); // Push the dawn intro text

        const totalMonsters = Object.values(gameState.horde).reduce((sum, list) => sum + list.length, 0); // Count any leftover monsters
        // If there is a monster, push the win message with monsters accounted for
        if (totalMonsters > 0) {
            finalMessages.push(gameData.texts.game_over_win_monsters);
        }
        // If player health is low, push the critical win message
        if (gameState.player.health <= 15) {
            finalMessages.push(gameData.texts.game_over_win_critical);
        } else {
            finalMessages.push(gameData.texts.game_over_win_normal);
        }
    }
    const endMessage = finalMessages.join(" "); // Join the final text

    console.log(consequenceAndThreatText + "\n\n" + chalk.magenta.italic(endMessage)); // Print both the texts
    process.exit(0); // End the game session
}

/**
 * Runs the main game loop
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 */
async function runGameLoop(gameState, gameData) {
    while (true) {
        
        // ---- START OF TURN FUNCTIONS ----
        processTimedEvents(gameState,gameData);         // Horde Spawning
        processNoiseSpawning(gameState, gameData);      // High-noise monster spawning
        processNoiseDespawning(gameState, gameData);    // Noise-spawned monsters despawning
        trapMonster(gameState, gameData);               // Kills monsters if trap is set
        processFortificationDamage(gameState,gameData); // Monsters damage fortification

        const promptText = buildPromptText(gameState, gameData); // Build prompt text comprising of timeline, location, consequence, threat, status, call-to-action

        const validActions = getCurrentActions(gameState, gameData); // Fetches all valid actions in the current state
        const chosenAction = updateConsoleUI(promptText, validActions, prompt, gameState); // Updates the console UI with new text & options and prompts player for choice
        // 'chosenAction' is the option object the player selected, e.g., { id: "move_to_graveyard", ... }

        console.log(chalk.yellow(`\nYou chose: ${chosenAction.id}`)); // For Debugging / Feedback

        gameState.world.previousLocation = gameState.world.currentLocation; // Update previous turn's location

        // ---- END OF TURN FUNCTIONS ----
        handleEffects(chosenAction, gameState, gameData);   // Handles the effects of the chosen action
        processPlayerDamage(gameState, gameData);           // Monsters damage player
        tickClock(gameState);                               // Decrement actions remaining & cooldowns
        checkGameStatus(gameState, gameData);               // Check for win/lose, else continue
        
        prompt('Press Enter to continue to the next (mock) turn...');
    }
}

// Run the game
startGame();