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