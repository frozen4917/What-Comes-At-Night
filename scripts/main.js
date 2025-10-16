import promptSync from "prompt-sync";
import chalk from "chalk";
const prompt = promptSync({ sigint: true });

import { loadGameData } from './loader.js';
import { updateConsoleUI } from './ui.js';
import { getRandomInt, areConditionsMet } from './utils.js';

export function buildPromptText(gameState, gameData) {
    const { world, status } = gameState; // Deconstruct gameState
    const { texts } = gameData;

    const timelineKey = `${world.currentPhaseId}_flavor_${world.actionsRemaining}`; // Timeline flavor text: Build key, e.g. dusk_flavor_4
    const timelineText = texts[timelineKey] || `The night continues...`; // Actual text from texts.json

    // Location description
    let locationDescription = '';
    const locationKeyBase = `loc_desc_${world.currentLocation}`;    // Location base e.g. loc_desc_campsite
    
    if (!world.visitedLocations.includes(world.currentLocation)) {
        // First-time visit
        locationDescription = texts[locationKeyBase + '_first'];    // Location text on first visit e.g. loc_desc_campsite_first
        world.visitedLocations.push(world.currentLocation);         // Mark as visited
    } else if (world.currentLocation === world.previousLocation) {
        // Player is still in the same location
        const locationArrayBase = locationKeyBase + '_current';     // Array base of the location e.g. loc_desc_cabin_current[]
        locationDescription = texts[locationArrayBase][getRandomInt(0,texts[locationArrayBase].length - 1)]     // Randomly select from array
    } else {
        // Player has returned to a previously visited location
        const locationArrayBase = locationKeyBase + '_return';      // Array base of the location e.g. loc_desc_cabin_return
        locationDescription = texts[locationArrayBase][getRandomInt(0,texts[locationArrayBase].length - 1)]     // Randomly select from array
    }

    // Get the status/consequence of prev. turn message (placeholder) -- TODO
    const statusMessage = status.message;
    status.message = ""; // Clear the message after retrieving it

    // Get threat text -- TODO
    const threatText = ""; // TODO

    // Assemble all parts into a final string
    const parts = [timelineText, locationDescription, statusMessage, threatText];
    return parts.filter(part => part).join('\n\n'); // Filter out empty parts and join
}

// WORK IN PROGREEESSSSSS
export function getCurrentActions(gameState, gameData) {
    const validActions = [];
    const locationData = gameData.locations[gameState.world.currentLocation]; // Current location's option menu

    // I. Process static actions from the location's menu (MOVE, FORTIFY, etc.)
    if (locationData.menu) {
        for (const category of locationData.menu) {
            for (const action of category.subActions) {
                // Check if the action's conditions are met
                if (areConditionsMet(action.showIf, gameState)) {
                    // For now, we'll just add the action object directly.
                    // Later, we'll look up the text_ref.
                    validActions.push({
                        id: action.id,
                        displayText: gameData.texts[action.text_ref] || action.id,
                        effects: action.effects
                    });
                }
            }
        }
    }
    
    // II. Dynamically generate GATHER actions from Points of Interest
    if (locationData.pointsOfInterest) {
        for (const poiId in locationData.pointsOfInterest) {
            const poi = locationData.pointsOfInterest[poiId];
            
            const hasBeenScavenged = gameState.world.scavengedLocations.includes(poiId);
            const isRenewable = poi.renewableLoot !== undefined;

            if (!hasBeenScavenged || isRenewable) {
                // This POI is available to be searched. Create an action for it.
                validActions.push({
                    id: `search_${poiId}`,
                    displayText: `Search the ${gameData.texts[poi.name_ref]}`,
                    // We will need to create a special effect for this later
                    effects: { scavenge: poiId } 
                });
            }
        }
    }

    // III. (Future/TODO) Dynamically generate ATTACK, USE, CRAFT actions here...

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
        message: "" // Consequence of previous action
    };
    
    // 5. Assemble and return the complete gameState object
    return {
        player,
        world,
        horde,
        status
    };
}

// The main entry point for your game.
async function startGame() {
    const gameData = await loadGameData(); // Get Game Data object
    
    // You can now access all your data from this one object.
    console.log("Axe damage:", gameData.items.axe.effects.single_attack.damage);
    console.log("Dusk phase actions:", gameData.phases.phases[0].durationInActions);
    console.log(chalk.green(gameData.texts.dusk_flavor_4));
    
    // ... initializeGameState() and main game loop would start here ...
    const gameState = initializeGameState(gameData);
    
    runGameLoop(gameState, gameData);
}

// TODO Game loop
// 16/10/2025 - Basic functionality: Prompt text, option list, display option chosen
async function runGameLoop(gameState, gameData) {
    while (true) {
        // ---- FUTURE START OF TURN FUNCTIONS ----
        // processTimedEvents()
        // processMonsterActions()

        // 1. Build the prompt text
        const promptText = buildPromptText(gameState, gameData);

        // 2. Get the valid action list
        const validActions = getCurrentActions(gameState, gameData);

        // 3. Call the UI function to display everything and get input
        // It takes the text, the actions, and the prompt function as arguments.
        const chosenAction = updateConsoleUI(promptText, validActions, prompt);
        // 'chosenAction' is now the object the player selected, e.g., { id: "move_to_graveyard", ... }

        // 4. Process the player's choice
        console.log(chalk.yellow(`\nYou chose: ${chosenAction.id}`)); // For debugging

        // ---- FUTURE FUNCTIONS ----
        // handleEffects(chosenAction.effects, gameState);
        // tickClock(gameState, gameData);
        // checkGameStatus(gameState);
        
        // For now, let's just pause to see the result.
        prompt('Press Enter to continue to the next (mock) turn...');
    }
}

// Run the game.
startGame();