import promptSync from "prompt-sync";
import chalk from "chalk";
const prompt = promptSync({ sigint: true });

import { getRandomInt, checkAndSetGracePeriod } from './utils.js';


function getTargetFortification(world) {
    switch (world.hordeLocation) {
        case "campGate": return "campGate"; // Horde at camp gate attacks gate
        case "graveyardGate": return "graveyardGate"; // Horde at graveyard gate attacks gate
        case "campsite": return "cabin"; // Horde at campsite attacks cabin
        default: return null;
    }
}

function getHordeMonsters(horde, type) {
    return horde[type].filter(m => m.persistent);
}

function getLoneMonsters(horde, type) {
    return horde[type].filter(m => !m.persistent);
}

export function trapMonster(gameState, gameData) {
    const trapKey = gameState.world.hordeLocation; // "campGate" or "graveyardGate"
    let trappedMonsters = []; // Store the types of monsters killed

    while (gameState.world.traps && gameState.world.traps[trapKey] > 0) {
        
        // Build a list of ONLY zombies, skeletons, and spirits currently present
        let trappableMonsters = [];
        ["zombie", "skeleton", "spirit"].forEach(type => {
            if (gameState.horde[type] && gameState.horde[type].length > 0) {
                trappableMonsters.push(...gameState.horde[type].map(m => ({ ...m, type: type })));
            }
        });

        // If no more monsters left to trap, break the loop
        if (trappableMonsters.length === 0) break;

        gameState.world.traps[trapKey]--; 

        // Pick a random monster
        const randomIndex = getRandomInt(0, trappableMonsters.length - 1);
        const targetMonster = trappableMonsters[randomIndex];
        const targetType = targetMonster.type; // Get type directly
        const targetId = targetMonster.id;

        // Remove the monster (using filter)
        gameState.horde[targetType] = gameState.horde[targetType].filter(m => m.id !== targetId);

        // Add the type to our list for the final message
        trappedMonsters.push(targetType); 
    }

    if (trappedMonsters.length > 0) {
        let messageParam = "";

        if (trappedMonsters.length === 1) {
            // Single kill: "a Zombie"
            messageParam = `a ${gameData.monsters[trappedMonsters[0]].name}`;
        } else {
            // Multiple kills: Count types
            const counts = trappedMonsters.reduce((acc, type) => {
                acc[type] = (acc[type] || 0) + 1;
                return acc;
            }, {}); // e.g., { zombie: 2, spirit: 1 }

            const parts = Object.entries(counts).map(([type, count]) => {
                const name = gameData.monsters[type].name;
                return `${count} ${name}${count > 1 ? 's' : ''}`; // e.g., "2 Zombies", "1 Spirit"
            });
            
            // Join with "and": "2 Zombies and 1 Spirit"
            if (parts.length > 1) {
                messageParam = parts.slice(0, -1).join(', ') + ' and ' + parts.slice(-1);
            } else {
                messageParam = parts[0]; // e.g., "2 Zombies"
            }
        }

        gameState.status.messageQueue.push({
            text_ref: "outcome_trap_triggered",
            params: {
                count: (trappedMonsters.length === 2) ? 'two' : 'a',
                monsterName: messageParam
            }
        });
    }
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
            const hordeMonsters = horde[monsterType];
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
            
            let noLongerHiding = '';
            if (newHordeLocation === gameState.world.currentLocation) {
                // If the player was hiding, they are NOT anymore.
                if (gameState.status.playerState === "hiding") {
                    gameState.status.playerState = "normal";
                    noLongerHiding = " You were spotted instantly! You are no longer hidden!"
                }
            }
            
            world.hordeLocation = newHordeLocation;
            gameState.status.messageQueue.push({
                text_ref: "threat_fortification_breached_" + fortificationID,
                params: { 
                    noLongerHiding: noLongerHiding 
                }
            });
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
                    currentHealth: monsterData.health + getRandomInt(-1, 1),
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

    gameState.status.gameMode = 'combat';

    // 3. Push the main spawn message
    if (hordeCompositionText.length > 0) {
        gameState.status.messageQueue.push({
            text_ref: "threat_horde_spawn_timed_" + world.currentPhaseId,
            params: { composition: hordeCompositionText.join(', ') }
        });
    }
}

export function processNoiseSpawning(gameState, gameData) {
    const { world, status, horde } = gameState;
    const { phases, monsters } = gameData;

    // Check if noise threshold is met
    if (world.noise < 50) return;
    
    // Check if a "grace period" is active (after clearing all monsters)
    if (status.gracePeriodCooldown > 0) return; // Player is in a grace period

    // Check if the "repeated spawn" cooldown is active (after a recent spawn)
    if (status.repeatedSpawnCooldown > 0) return; // A monster just spawned recently

    // Find the current phase's noise spawn pool
    const currentPhase = phases.phases.find(p => p.id === world.currentPhaseId);
    if (!currentPhase || !currentPhase.noiseSpawnPool || currentPhase.noiseSpawnPool.length === 0) {
        return; // Phase doesn't spawn monsters from noise
    }

    // --- All checks passed, spawn a monster! ---

    // Select a random monster type from the pool
    const pool = currentPhase.noiseSpawnPool;
    const monsterType = pool[Math.floor(Math.random() * pool.length)];
    const monsterData = monsters[monsterType];

    // Create the monster instance
    const newMonster = {
        id: `${monsterType}_noise_${status.noiseSpawnCount}`,
        currentHealth: monsterData.health + getRandomInt(-3, 1),
        persistent: false // This marks it as a "lone" monster
    };

    // Add monster to the horde list and update status
    horde[monsterType].push(newMonster);
    status.gameMode = "combat_lone";      // Change game mode
    status.repeatedSpawnCooldown = 3;   // Set the 3-turn REPEAT cooldown
    status.noiseSpawnCount++;  // Increment the unique ID counter

    // Set horde location
    if (!world.hordeLocation) {
        if (world.currentLocation === "campsite" || world.currentLocation === "cabin") {
            world.hordeLocation = "campGate";
        } else if (world.currentLocation === "graveyard") {
            world.hordeLocation = "graveyardGate";
        }
    }

    // Add a message to the queue
    gameState.status.messageQueue.push({
        text_ref: "threat_noise_spawn", // e.g., "The noise attracts a {monsterName}!"
        params: { 
            monsterName: monsterData.name 
        }
    });
}

export function processNoiseDespawning(gameState, gameData) {
    const { world, horde, status } = gameState;
    const { monsters } = gameData;

    if (status.gameMode !== 'combat_lone') return;

    // If player is not hiding, monsters are engaged. Do not despawn
    // Distance is not too far (player and monsters are not 'two' moves away). Do not Despawn
    if (status.playerState !== "hiding" && !(world.currentLocation === 'cabin' && world.hordeLocation === 'campGate')) return;

    // Stores the counts directly by type, e.g: { zombie: 2, spirit: 1 }
    const despawnedCounts = {};
    
    // Identify, count, and remove all applicable monsters
    for (const monsterType in horde) {
        // Find all lone monsters of this type
        const loneMonsters = getLoneMonsters(horde, monsterType);
        if (loneMonsters.length === 0) {
            continue; // No lone monsters of this type
        }

        const monsterData = monsters[monsterType];
        if (!monsterData) continue; // Safety check

        const specials = monsterData.behavior.special || [];
        
        // Determine the noise threshold for this monster type
        let despawnThreshold = -1;
        if (specials.includes("lingers_short")) despawnThreshold = 35;
        else if (specials.includes("lingers_long")) despawnThreshold = 25;

        // If the noise is low enough...
        if (despawnThreshold > 0 && world.noise < despawnThreshold) {
            // Add this type to our count for the message
            despawnedCounts[monsterType] = loneMonsters.length;
            
            // Filter the list
            horde[monsterType] = horde[monsterType].filter(m => m.persistent);
        }
    }

    // If no monsters were despawned, exit early.
    const despawnedTypes = Object.keys(despawnedCounts);
    if (despawnedTypes.length === 0) {
        return;
    }

    // Generate the combined despawn message
    let totalDespawned = 0;

    // Convert types/counts to strings: e.g., ["the Zombies", "the Spirit"]
    const nameStrings = despawnedTypes.map(type => {
        const count = despawnedCounts[type];
        const name = monsters[type].name; // Get name from gameData
        
        totalDespawned += count; // Add to the total count for grammar check
        
        if (count > 1) return `the ${name}s`
        return `the ${name}`;
    });

    // Combine strings into a final list
    let monsterListString = "";
    if (nameStrings.length === 1) {
        monsterListString = nameStrings[0]; // e.g., "the Zombies"
    } else if (nameStrings.length === 2) {
        monsterListString = nameStrings.join(' and '); // e.g., "the Zombies and the Spirit"
    } else {
        monsterListString = nameStrings.slice(0, -1).join(', ') + ', and ' + nameStrings.slice(-1);
    }
    
    // Push the single, combined message to the queue
    gameState.status.messageQueue.push({
        text_ref: "threat_noise_despawn", // e.g., "{monsterList} {verb} off..."
        params: { 
            monsterList: monsterListString,
            loseVerb: (totalDespawned > 1) ? "lose" : "loses",
            wanderVerb: (totalDespawned > 1) ? "wander" : "wanders"
        }
    });
    

    checkAndSetGracePeriod(gameState)
}