import chalk from "chalk";

import { getRandomInt, renderText } from "./utils.js";

/**
 * Builds the prompt text by combining timeline flavour text, location text, consequence text, threats text, status text, and call-to-action
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 * @returns {string} Entire prompt text
 */
export function buildPromptText(gameState, gameData) {
    const { player, world, status } = gameState; // Deconstruct gameState
    const { texts } = gameData;

    // --- TIMELINE TEXT ---
    // This is purely flavor text based on the current phase and actions remaining

    const timelineKey = `${world.currentPhaseId}_flavor_${world.actionsRemaining}`; // Timeline flavor text's key, e.g. dusk_flavor_4
    const timelineText = texts[timelineKey] || `The night continues...`; // Actual text from texts.json. Fallback in case of missing text


    // --- LOCATION TEXT ---
    // This gives location-related texts, such as introducing a new place, or giving texts for when you return back to an already visited place
    let locationDescription = '';
    const locationKeyBase = `loc_desc_${world.currentLocation}`; // Location base, e.g. loc_desc_campsite
    
    if (!world.visitedLocations.includes(world.currentLocation)) {
        // --- First time visit ---
        locationDescription = texts[locationKeyBase + '_first'];    // Location text on first visit e.g. loc_desc_campsite_first
        world.visitedLocations.push(world.currentLocation);         // Mark as visited

    } else if (world.currentLocation === world.previousLocation) {
        // --- Same location as previous turn ---
        const locationArrayBase = locationKeyBase + '_current';     // Array base of the location e.g. loc_desc_cabin_current[]
        locationDescription = texts[locationArrayBase][getRandomInt(0,texts[locationArrayBase].length - 1)]     // Randomly select from array

    } else {
        // --- Return from another location ---
        const locationArrayBase = locationKeyBase + '_return';      // Array base of the location e.g. loc_desc_cabin_return
        locationDescription = texts[locationArrayBase][getRandomInt(0,texts[locationArrayBase].length - 1)]     // Randomly select from array

    }

    // --- CONSEQUENCE & THREAT ---
    // This includes consequence of previous actions like crafting, attacking, fortifying, etc. and threat messages like horde spawning, attacks, lone monster spawning/despawning, etc.

    // Messages are fetched from message queue, rendered to replace placeholders, and then added to an array, which is then converted into the text
    // Example of object in messageQueue: { text_ref: "threat_horde_spawn_timed", params: { hordeComposition: "..." } }
    const messageStrings = [];
    if (status.messageQueue && status.messageQueue.length > 0) {

        // Loop over every message object in the queue
        for (const messageObject of status.messageQueue) {
            
            // 1. Get the template string from texts.json
            const template = texts[messageObject.text_ref];
            
            if (template) {
                // 2. Use renderText to build the final string
                const renderedMessage = renderText(template, messageObject.params);
                
                // 3. Add it to our list
                messageStrings.push(renderedMessage);
            } else {
                messageStrings.push(`[Missing text_ref: ${messageObject.text_ref}]`);
            }
        }
        
        // 4. Clear array
        status.messageQueue = [];
    }

    const consequenceAndThreatText = messageStrings.join('\n');


    // --- STATUS MESSAGE ---
    // Gives warnings for low health or stamina

    const statusMessages = [];
    
    // Health Warnings
    if (player.health <= 15) {
        statusMessages.push(texts.status_health_critical);
    } else if (player.health <= 35) {
        statusMessages.push(texts.status_health_low);
    }

    // Stamina Warnings
    if (player.stamina <= 15) {
        statusMessages.push(texts.status_stamina_critical);
    } else if (player.stamina <= 35) {
        statusMessages.push(texts.status_stamina_low);
    }
    
    // Join all status messages
    const statusText = statusMessages.join('\n');

    // Assemble all parts into a final string
    const parts = [timelineText, locationDescription, consequenceAndThreatText, statusText];
    return parts.filter(part => part).join('\n\n'); // Filter out empty parts and join
}


/**
 * Updates the console UI, provides options, and accepts input
 * @param {string} promptText Prompt text to be displayed
 * @param {Object[]} actions Array of valid action objects
 * @param {(message: string) => string} prompt The prompt-sync function instance.
 * @param {Object} gameState Current dynamic game state
 * @returns {Object} The chosen action's object
 */
export function updateConsoleUI(promptText, actions, prompt, gameState) {
    console.clear(); // Clear the console

    // Print basic stats
    console.log(chalk.redBright(`HP: ${gameState.player.health}, Stamina: ${gameState.player.stamina}`));
    console.log(chalk.yellow(`Noise: ${gameState.world.noise}`))
    console.log(chalk.blueBright(`${gameState.world.currentPhaseId} - ${gameState.world.actionsRemaining} Actions remaining`));

    // Print the prompt text
    console.log(promptText);
    console.log('\n=================================\n');

    // Display all of the available actions
    actions.forEach((action, index) => {
        const letter = String.fromCharCode(65 + index); // Starts with A
        console.log(chalk.gray(`  ${letter}. ${action.displayText}`)); // e.g "A. Move to Cabin"
    });
    console.log('\n---------------------------------');

    // Loop until valid input in received
    while (true) {
        const choice = prompt('> ').toUpperCase();
        const choiceIndex = choice.charCodeAt(0) - 65; // A=0, B=1, C=2...

        // If 'Z', go to debug mode
        // WARNING: REMOVE AFTER COMPLETION
        if (choiceIndex == 25) {
            debugEval(prompt, gameState);
        } else if (choiceIndex >= 0 && choiceIndex < actions.length) {
            // --- Valid choice received ---
            return actions[choiceIndex];
        } else {
            console.log(chalk.redBright("Invalid choice. Please enter a valid letter."));
        }
    }
}

function debugEval(prompt, gameState) {
    while (true) {
        try {
            const exp = prompt('-> ');
            if (exp === 'exit()') {
                break;
            }
            if (exp === 'nightfall()') {
                gameState.world.currentPhaseId = 'nightfall';
                gameState.world.actionsRemaining = 8;
                continue;
            }
            if (exp === 'witching()') {
                gameState.world.currentPhaseId = 'witching_hour';
                gameState.world.actionsRemaining = 10;
                continue;
            }
            if (exp === 'vampire()') {
                gameState.horde.vampire.push({ id: "vampire_commands_0", currentHealth: 100, persistent: true});
                continue;
            }
            if (exp === 'witch()') {
                gameState.horde.witch.push({ id: "witch_commands_0", currentHealth: 85, persistent: true});
                continue;
            }
            if (exp === 'setup()') {
                gameState.player.inventory.molotov = 2;
                gameState.player.inventory.axe = 1;
                gameState.player.inventory.black_salt = 2;
                gameState.player.inventory.witch_ward = 2;
                gameState.player.health = 300;
                gameState.world.fortifications.campGate = 280;
                continue;
            }
            if (exp === 'predawn()') {
                gameState.world.currentPhaseId = 'witching_hour';
                gameState.world.actionsRemaining = 1;
                continue;
            }
            console.log(eval(exp));
        } catch (err) {
            console.log(chalk.redBright("Error in expression!"));
        }
    }
}