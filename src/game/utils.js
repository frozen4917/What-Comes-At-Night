/**
 * Generates and returns a random integer between min and max, both inclusive
 * @param {number} min Lower bound
 * @param {number} max Upper bound
 * @returns {number} Random integer
 */
export function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Checks if the action meets all conditions from the showIf array
 * @param {Object[]} conditions 
 * @param {Object} gameState Current dynamic game state
 * @returns {boolean} True if all conditions are met, else false
 */
export function areConditionsMet(conditions, gameState) {

    // If there's no showIf array, the action is always available.
    if (!conditions) return true;

    // Check for all conditions in the showIf
    // .every() checks if ALL conditions in the array return true.
    return conditions.every(condition => {
        const key = Object.keys(condition)[0];
        const value = condition[key];

        switch (key) {
            case "gameModeIs":
                return gameState.status.gameMode === value;

            case "minStamina":  // Minimum Stamina required
                return gameState.player.stamina >= value;

            case "hordeLocationNotIn":  // Checks if the current location is NOT in the forbidden list.
                return !value.includes(gameState.world.hordeLocation);

            case "hasItem":  // Checks if the item exists in inventory and has a quantity > 0.
                return gameState.player.inventory[value] > 0;

            case "hasAnyItem":  // Checks if any item in the array is in the inventory or not
                return value.some(item => gameState.player.inventory[item] > 0);

            case "hasItems":  // Checks for all items and minimum quantities in the inventory
                return Object.entries(value).every(([item, quantity]) =>
                    (gameState.player.inventory[item] || 0) >= quantity
                );

            case "atLocation":
                return gameState.world.currentLocation === value;
            
            case "isTargetAdjacent": // False if player is at cabin and horde is at campgate, else true
                return !(gameState.world.currentLocation === 'cabin' && gameState.world.hordeLocation === 'campGate');

            case "notScavenged":
                return !gameState.world.scavengedLocations.includes(value);

            case "flagIsTrue":
                return gameState.world.flags[value] === true;

            case "flagIsFalse":
                return gameState.world.flags[value] === false;

            case "monsterIsPresent":
                return gameState.horde[value] && gameState.horde[value].length > 0;

            case "bossIsPresent":
                return gameState.horde[value] && gameState.horde[value].length > 0;

            case "hordeSizeIsGreaterThan":
                const totalMonsters = Object.values(gameState.horde).reduce((sum, list) => sum + list.length, 0);
                return totalMonsters > value;

            default:
                // If the condition is unknown, assume it's okay, but return a warning
                console.error(`Unknown condition key: ${key}`);
                return true;
        }
    });
}

/**
 * 
 * @param {string} template Text from texts.json along with placeholders, e.g.: "You dealt {damage} HP of damage."
 * @param {Object} params Values for placeholders, e.g.: { damage: 23, weapon: "axe" }
 * @returns {string} Text with placeholders replaced by values
 */
export function renderText(template, params) {
    // If no params, the template has no placeholders. Return the template
    if (!params) return template;

    // Regex to capture "{...}"
    const regex = /{(\w+)}/g;
    return template.replace(regex, (match, key) => {
        // 'match' is the full text that was matched, e.g., {damage}
        // 'key' is just the captured part (the word inside), e.g., "damage"

        // Check if the key exists in params object.
        // If it does, return the value from the params.
        // If it doesn't, return the original match
        return params[key] !== undefined ? params[key] : match;
    });
}

/**
 * Checks for absence of monsters and updates gameMode, hordeLocation, and cooldowns
 * @param {Object} gameState Current dynamic game state
 * @param {Object} gameData Game-related data
 */
export function checkAndSetGracePeriod(gameState, gameData) {
    const { status, horde, world } = gameState;

    if (status.gameMode === 'exploring') return;

    // Count ALL monsters left on the board.
    let totalMonsters = 0;
    for (const monsterType in horde) {
        totalMonsters += horde[monsterType].length;
    }

    if (totalMonsters > 0) return;

    // --- If we are here, totalMonsters is 0 ---
    // The board is clear! Reset the game state.

    status.gameMode = 'exploring';
    world.hordeLocation = "";

    // Cooldowns
    status.gracePeriodCooldown = gameData.settings.COOLDOWNS.GRACE_PERIOD;
    status.repeatedSpawnCooldown = 0;
}

/**
 * Formats the monster list using numbers or using determiners
 * @param {Object<string, number>} monsterCounts Counter object storing monster key and count pairs
 * @param {Object} gameData Game-related data
 * @param {{mode: "determiner", determiner: string} | {mode: "counter"}} options Configuration for how to format the string
 * @returns {string} Formatted string with numbers/determiners
 */
export function formatMonsterList(monsterCounts, gameData, options) {
    const parts = [];
    const monsterTypes = Object.keys(monsterCounts); // Stores all monster types (keys from the counter)

    if (monsterTypes.length === 0) return ""; // If no monsters, return empty string

    // Loop through all monster types
    for (const type of monsterTypes) {
        const count = monsterCounts[type];
        if (count === 0) continue; // Safety clause: skip the monster type if no monsters of that type
        
        const name = gameData.monsters[type].name; // e.g., "Witch"

        // Handle pluralization
        let pluralName;
        if (count === 1) {
            pluralName = name;
        } else if (name.endsWith('h')) {
            pluralName = name + 'es'; // Handles "Witch" -> "Witches"
        } else {
            pluralName = name + 's'; // Handles "Zombie" -> "Zombies"
        }

        if (options.mode === 'counter') {
            // Counter mode --> returns number and monster type, e.g. 2 Zombies, 1 Spirit, etc.
            parts.push(`${count} ${pluralName}`);
        } else if (options.mode === 'determiner') {
            // Determiner mode --> uses determiners, e.g. the Zombies, the Spirit
            const determiner = options.determiner || 'the';
            parts.push(`${determiner} ${pluralName}`);
        }
    }

    // Join the parts with correct grammar (commas and "and")
    if (parts.length === 1) {
        return parts[0]; // Return same if alone, e.g. "2 Zombies"
    } else if (parts.length === 2) {
        return parts.join(' and '); // Join with 'and' if two types are involved, e.g. "1 Zombie and 2 Spirits"
    } else {
        return parts.slice(0, -1).join(', ') + ', and ' + parts.slice(-1); // Join with ',' and 'and' if more that two types are involved, e.g. "1 Zombie, 2 Spirits, and 2 Skeletons"
    }
}

/**
 * Returns object with monster name and count. Excludes ones with zero count. Filters based on linger duration if needed.
 * @param {Object} horde Active horde object
 * @param {"all" | "ligners_long" | "lingers_short"} condition Filter condition
 * @param {Object} gameData Game-related data
 * @returns {Object<string, number>} monster name and count 
 */
export function countMonsters(horde, condition = "all", gameData) {
    return Object.entries(horde)
        .filter(([type, monsters]) => {
            // Skip empty arrays always
            if (!monsters.length) return false;

            // --- Handle conditions ---

            // If condition: "all", return every monster type
            if (condition === "all") return true;

            const specials = gameData.monsters[type].behavior.special || []; // Look for special behavior
            // If condition: "lingers_long", return long lingering monsters
            if (condition === "lingers_long") {
                return specials.includes("lingers_long");
            }
            // If condition: "lingers_short", return short lingering monsters
            if (condition === "lingers_short") {
                return specials.includes("lingers_short");
            }

            return false;
        })
        .reduce((acc, [type, monsters]) => {
            acc[type] = monsters.length;
            return acc;
        }, {});
}

/**
 * Chooses a move based on weights(probability)
 * @param {{ name: string, weight: number}} movePool 
 * @returns {{ name: string, weight: number}} Chosen move
 */
export function chooseWeightedMove(movePool) {
    let roll = getRandomInt(1, 100);
    let cumulativeWeight = 0;

    for (const move of movePool) {
        cumulativeWeight += move.weight;
        if (roll <= cumulativeWeight) {
            return move;
        }
    }
}