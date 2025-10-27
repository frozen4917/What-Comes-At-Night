import chalk from "chalk";

import { getRandomInt, renderText } from "./utils.js";

export function buildPromptText(gameState, gameData) {
    const { player, world, status } = gameState; // Deconstruct gameState
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

    // CONSEQUENCE & THREAT
    // example of messageQueue object:
    // { text_ref: "threat_horde_spawn_timed", params: { hordeComposition: "..." } }
    const messageStrings = [];
    if (status.messageQueue && status.messageQueue.length > 0) {
        
        // Loop over every message object in the queue
        for (const messageObject of status.messageQueue) {
            
            // 1. Get the template string from texts.json
            const template = texts[messageObject.text_ref];
            
            if (template) {
                // 2. Use your renderText helper to build the final string
                const renderedMessage = renderText(template, messageObject.params);
                
                // 3. Add it to our list
                messageStrings.push(renderedMessage);
            } else {
                messageStrings.push(`[Missing text_ref: ${messageObject.text_ref}]`);
            }
        }
        
        // 4. ADD THIS LINE: Clear the queue for the next turn
        status.messageQueue = []; // <--- THIS IS THE FIX
    }

    const consequenceAndThreatText = messageStrings.join('\n');


    // STAT MESSAGE
    // Gives warnings for low health
    const statMessages = [];
    
    // Health warnings
    if (player.health <= 15) {
        statMessages.push(texts.status_health_critical);
    } else if (player.health <= 35) {
        statMessages.push(texts.status_health_low);
    }
    // Stamina warnings
    if (player.stamina <= 15) {
        statMessages.push(texts.status_stamina_critical);
    } else if (player.stamina <= 35) {
        statMessages.push(texts.status_stamina_low);
    }
    
    // Join all stat messages
    const statsText = statMessages.join('\n');

    // Assemble all parts into a final string
    const parts = [timelineText, locationDescription, consequenceAndThreatText, statsText];
    return parts.filter(part => part).join('\n\n'); // Filter out empty parts and join
}


// WORK IN PROGRESS
// BASIC UPDATE CONSOLE UI FUNCTION
// Prints Text and actions. Handles option input.
export function updateConsoleUI(promptText, actions, prompt, gameState) {
    console.clear();
    console.log(chalk.redBright(`HP: ${gameState.player.health}, Stamina: ${gameState.player.stamina}`));
    console.log(chalk.yellowBright(``))
    console.log(chalk.blueBright(`${gameState.world.currentPhaseId} - ${gameState.world.actionsRemaining} Actions remaining`));


    console.log(promptText);
    console.log('\n=================================\n');

    // Display the available actions
    actions.forEach((action, index) => {
        const letter = String.fromCharCode(65 + index);
        // For now, just the action ID as the display text.
        // TODO: Replace properly with option text later.
        console.log(chalk.gray(`  ${letter}. ${action.id}`));
    });
    console.log('\n---------------------------------');

    // Loop until valid input
    while (true) {
        const choice = prompt('> ').toUpperCase();
        const choiceIndex = choice.charCodeAt(0) - 65; // A=0, B=1, C=2...

        // IF Z, go to Debug mode. 
        // WARNING: REMOVE AFTER COMPLETION
        if (choiceIndex == 25) {
            debugEval(prompt, gameState);
        } else if (choiceIndex >= 0 && choiceIndex < actions.length) {
            // Valid choice
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
            console.log(eval(exp));
        } catch (err) {
            console.log(chalk.redBright("Error in expression!"));
        }
    }
}