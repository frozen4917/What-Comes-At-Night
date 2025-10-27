import promptSync from "prompt-sync";
import chalk from "chalk";
const prompt = promptSync({ sigint: true });

import { getRandomInt, areConditionsMet, renderText } from './utils.js';

function getTargetFortification(world) {
    switch (world.hordeLocation) {
        case "campGate": return "campGate"; // Horde at camp gate attacks gate
        case "graveyardGate": return "graveyardGate"; // Horde at graveyard gate attacks gate
        case "campsite": return "cabin"; // Horde at campsite attacks cabin
        default: return null;
    }
}

export function getHordeMonsters(horde, type) {
    return horde[type].filter(m => m.persistent);
}

export function getLoneMonsters(horde, type) {
    return horde[type].filter(m => !m.persistent);
}

export function processFortificationDamage(gameState, gameData) {
    const { world, horde, player } = gameState;
    const { monsters } = gameData;
    
    // If there's no horde, do nothing.
    if (!world.hordeLocation) return; 

    if (world.hordeLocation === world.currentLocation) {
        return; 
    }

    // Find the fortification the horde is currently attacking
    const fortificationID = getTargetFortification(world);
    if (!fortificationID) return;

    let fortificationHP = world.fortifications[fortificationID];
    
    // Only attack if the fortification is standing
    if (fortificationHP > 0) {
        let hordeAttackSummary = { totalDamage: 0 };

        // Loop through all monster types
        for (const monsterType in horde) {
            const monsterData = monsters[monsterType];
            // Check if this monster type can even attack fortifications. If not, go to the next monster
            if (!monsterData.behavior.target.includes("fortification")) {
                continue;
            }

            // Get horde monsters of this type (e.g. Zombie)
            const hordeMonsters = getHordeMonsters(horde, monsterType);
            if (hordeMonsters.length > 0) {
                hordeAttackSummary.totalDamage += (monsterData.behavior.damage * hordeMonsters.length) + (getRandomInt(-1 * hordeMonsters.length, hordeMonsters.length));
            }
        }

        // --- Push Horde Attack Message ---
        if (hordeAttackSummary.totalDamage > 0) {
            fortificationHP -= hordeAttackSummary.totalDamage;
            gameState.status.messageQueue.push({
                text_ref: "threat_horde_attacks_fortification_" + fortificationID,
                params: {
                    totalDamage: hordeAttackSummary.totalDamage
                }
            });
        }

        // --- Handle Breach ---
        if (fortificationHP <= 0) {
            fortificationHP = 0;
            
            // Logic to move horde "inside"
            let newHordeLocation = "";
            if (world.hordeLocation === "campGate") newHordeLocation = "campsite";
            if (world.hordeLocation === "graveyardGate") newHordeLocation = "graveyard";
            if (world.hordeLocation === "campsite") newHordeLocation = "cabin";
            
            if (newHordeLocation) {
                world.hordeLocation = newHordeLocation;
                gameState.status.messageQueue.push({
                    text_ref: "threat_fortification_breached_" + fortificationID
                });
            }
        }
        
        // Update the fortification's final HP
        world.fortifications[fortificationID] = fortificationHP;
    }
}

export function processTimedEvents(gameState, gameData) {
    const { world, horde } = gameState;
    const { phases, monsters } = gameData;

    // Find the current phase data
    const currentPhase = phases.phases.find(p => p.id === world.currentPhaseId);
    if (!currentPhase || !currentPhase.events) return;

    // Check if any event triggers on the current action count
    const event = currentPhase.events.find(e => e.trigger.value === world.actionsRemaining);
    if (!event) return;

    // --- A Horde Spawn Event is Triggered! ---
    const spawnList = event.effect.spawn;
    let hordeCompositionText = [];

    // TODO: Convert non-persistent to persistent

    // 1. Spawn new monsters
    for (const spawn of spawnList) {
        if (spawn.monster) {
            const monsterType = spawn.monster;
            const count = spawn.count;
            const monsterData = monsters[monsterType];

            for (let i = 0; i < count; i++) {
                horde[monsterType].push({
                    id: `${monsterType}_${world.currentPhaseId}_${i}`,
                    currentHealth: monsterData.health + getRandomInt(-1,1),
                    persistent: true
                });
            }
            hordeCompositionText.push(`${count} ${monsterData.name}(s)`);
        }
        // TODO: Add Boss Pool logic here
    }

    // 2. Set Horde Location (if not already set)
    if (!world.hordeLocation) {
        if (world.currentLocation === "campsite" || world.currentLocation === "cabin") {
            world.hordeLocation = "campGate";
        } else if (world.currentLocation === "graveyard") {
            world.hordeLocation = "graveyardGate";
        }
    }

    // 3. Push the main spawn message
    if (hordeCompositionText.length > 0) {
        gameState.status.messageQueue.push({
            text_ref: "threat_horde_spawn_timed_" + world.currentPhaseId,
            params: { composition: hordeCompositionText.join(', ') }
        });
    }
}