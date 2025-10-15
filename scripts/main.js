import promptSync from "prompt-sync";
import chalk from "chalk";
const prompt = promptSync();

import { loadGameData } from './loader.js';


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
        visitedLocations: [initialState.initialGameState.currentLocation], // Start with the first location visited
        scavengedLocations: [],
        traps: {
            campGate: 0,
            graveyardGate: 0
        },
        hordeLocation: "" // Starts empty, no horde
    };

    // 3. Create the initial (empty) Horde state
    const horde = {
        spirit: [],
        zombie: [],
        skeleton: [],
        witch: [],
        vampire: []
    };

    // 4. Create the initial Status state
    const status = {
        gameMode: "exploring", // The game starts in exploration mode
        playerState: "normal",
        message: "You encounter a group of monsters trying to hunt you. You've managed to outrun them and get some time to get yourself under control. You find yourself in a campsite as the sun begins to set. The campsite could have items which could help you survive the onslaught." // A starting message
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
    console.log(gameState);
}

// Run the game.
startGame();