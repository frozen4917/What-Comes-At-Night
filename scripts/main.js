import promptSync from "prompt-sync";
import chalk from "chalk";
const prompt = promptSync({ sigint: true });

import { loadGameData } from './loader.js';
import { updateConsoleUI, buildPromptText } from './ui.js';
import { getRandomInt, areConditionsMet } from './utils.js';
import { trapMonster, processFortificationDamage, processTimedEvents, processNoiseSpawning, processNoiseDespawning } from "./monsterHandler.js";
import { handleEffects } from "./effectsHandler.js";



// WIP - NEW: Fetches available actions
export function getCurrentActions(gameState, gameData) {
    const validActions = [];
    const locationData = gameData.locations[gameState.world.currentLocation]; // Location specific data
    const globalData = gameData.globalActions; // Global options

    // A combined list of all menu definitions (local and global)
    const allMenuSources = [
        ...(locationData.menu || []),
        ...(globalData.menu || [])
    ];

    // Process all static actions from both location and global files
    for (const category of allMenuSources) {
        for (const action of category.subActions) {
            // Check if the action's conditions are met by the current game state
            if (areConditionsMet(action.showIf, gameState, gameData)) {
                
                // Create the final action object and add it to the list
                validActions.push({
                    id: action.id,
                    displayText: gameData.texts[action.text_ref] || action.id, // Fallback to ID if text_ref is missing
                    effects: action.effects
                });
            }
        }
    }

    return validActions;
}

export function initializeGameState(gameData) {
    const initialState = gameData.initialState;

    const player = {
        ...initialState.playerConfig.initialStats, // Spreads { health: 100, stamina: 100 }
        inventory: { ...initialState.playerConfig.initialInventory } // Creates a fresh copy
    };

    // 2. Create the World state
    const firstPhaseId = initialState.initialGameState.currentPhaseId;

    // Find the full data for the first phase to get its duration
    const firstPhaseData = gameData.phases.phases.find(p => p.id === firstPhaseId);
    if (!firstPhaseData) {
        // This is a critical error, the game can't start if the phase data is missing.
        console.error(chalk.red(`FATAL ERROR: Could not find phase data for initial phase ID: "${firstPhaseId}"`));
        process.exit(1);
    }
    
    const world = {
        ...initialState.initialGameState, // Spreads initial fortifications, noise, location, and flags
        actionsRemaining: firstPhaseData.durationInActions,
        visitedLocations: [],
        scavengedLocations: [],
        traps: {
            campGate: 0,
            graveyardGate: 0
        },
        hordeLocation: "" // Empty = No Horde
    };

    // 3. Empty Horde
    const horde = {
        spirit: [],
        zombie: [],
        skeleton: [],
        witch: [],
        vampire: []
    };

    // 4. Create the initial Status state
    const status = {
        gameMode: "exploring", // Exploring or combat
        playerState: "normal", // normal or hiding
        messageQueue: [], // Consequence of previous action + threat + monster damages
        noiseSpawnCount: 0,         // For unique monster IDs
        repeatedSpawnCooldown: 0,   // Cooldown between spawns
        gracePeriodCooldown: 0     // Cooldown after noise despawn/kill
    };
    
    // 5. Assemble and return the complete gameState object
    return {
        player,
        world,
        horde,
        status
    };
}

// The main entry point for the game.
async function startGame() {
    const gameData = await loadGameData(); // Get Game Data object
    
    // ... initializeGameState() and main game loop would start here ...
    const gameState = initializeGameState(gameData);
    
    runGameLoop(gameState, gameData);
}

function tickClock(gameState) {
    gameState.world.actionsRemaining -= 1;
    if (gameState.status.gracePeriodCooldown > 0) {
        gameState.status.gracePeriodCooldown -= 1;
    }
    if (gameState.status.repeatedSpawnCooldown > 0) {
        gameState.status.repeatedSpawnCooldown -= 1;
    }
}

function checkGameStatus(gameState, gameData) {
    if (gameState.player.health <= 0) {
        //endGame('lose');
    }
    if (gameState.world.actionsRemaining === 0) {
        const nextIndex = gameData.phases.phases.findIndex(phase => phase.id === gameState.world.currentPhaseId) + 1;

        gameState.world.currentPhaseId = gameData.phases.phases[nextIndex].id
        gameState.world.actionsRemaining = gameData.phases.phases[nextIndex] ? gameData.phases.phases[nextIndex].durationInActions : -1;
    }

    if (gameState.world.currentPhaseId === 'dawn') {
        //endGame('win');
    }
}

// TODO Game loop
async function runGameLoop(gameState, gameData) {
    while (true) {
        
        // ---- START OF TURN FUNCTIONS ----
        processTimedEvents(gameState,gameData);
        processNoiseSpawning(gameState, gameData);
        processNoiseDespawning(gameState, gameData);
        trapMonster(gameState, gameData);
        processFortificationDamage(gameState,gameData);

        // 1. Build the prompt text
        const promptText = buildPromptText(gameState, gameData);

        // 2. Get the valid action list
        const validActions = getCurrentActions(gameState, gameData);

        // 3. Call the UI function to display everything and get input
        // It takes the text, the actions, and the prompt function as arguments.
        const chosenAction = updateConsoleUI(promptText, validActions, prompt, gameState);
        // 'chosenAction' is now the object the player selected, e.g., { id: "move_to_graveyard", ... }

        // 4. Process the player's choice
        console.log(chalk.yellow(`\nYou chose: ${chosenAction.id}`));

        gameState.world.previousLocation = gameState.world.currentLocation;

        handleEffects(chosenAction, gameState, gameData);
        tickClock(gameState);
        checkGameStatus(gameState, gameData);
        
        // For now, let's just pause to see the result.
        prompt('Press Enter to continue to the next (mock) turn...');
    }
}

// Run the game.
startGame();