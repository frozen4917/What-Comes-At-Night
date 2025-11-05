import chalk from "chalk";

// RANDOM INT FROM MIN TO MAX
export function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Checks if conditions in showIf are met. If not, doesn't show the option
export function areConditionsMet(conditions, gameState) {
    // If there's no showIf array, the action is always available.
    if (!conditions) {
        return true;
    }

    // .every() checks if ALL conditions in the array return true.
    return conditions.every(condition => {
        const key = Object.keys(condition)[0];
        const value = condition[key];

        switch (key) {
            case "gameModeIs":
                return gameState.status.gameMode === value;

            case "minStamina":
                return gameState.player.stamina >= value;

            case "hordeLocationNotIn":
                // Checks if the current location is NOT in the forbidden list.
                return !value.includes(gameState.world.hordeLocation);

            case "hasItem":
                // Checks if the item exists in inventory and has a quantity > 0.
                return gameState.player.inventory[value] > 0;

            case "hasAnyItem":
                return value.some(item => gameState.player.inventory[item] > 0);

            case "hasItems":
                return Object.entries(value).every(([item, quantity]) =>
                    (gameState.player.inventory[item] || 0) >= quantity
                );

            case "atLocation":
                return gameState.world.currentLocation === value;

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
                // If the condition is unknown, assume it's okay for now.
                console.warn(chalk.red(`Unknown condition key: ${key}`));
                return true;
        }
    });
}

export function renderText(template, params) {
    if (!params) return template;
    // template is the text with placeholders, example: "You dealt {damage} HP of damage""
    // params is an object comprising of placeholder values example: {"damage": 23}

    const regex = /{(\w+)}/g;
    return template.replace(regex, (match, key) => {
        // 'match' is the full text that was matched, example, {damage}
        // 'key' is just the captured part (the word inside), example., "damage"

        // Check if the key exists in params object.
        // If it does, return the value from the params.
        // If it doesn't, return the original match
        return params[key] !== undefined ? params[key] : match;
    });
}

export function checkAndSetGracePeriod(gameState) {
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
    status.gracePeriodCooldown = 3;
    status.repeatedSpawnCooldown = 0;
}

export function formatMonsterList(monsterCounts, gameData, options) {
    const parts = [];
    const monsterTypes = Object.keys(monsterCounts);

    if (monsterTypes.length === 0) return "";

    for (const type of monsterTypes) {
        const count = monsterCounts[type];
        if (count === 0) continue;
        
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
            parts.push(`${count} ${pluralName}`);
        } else if (options.mode === 'determiner') {
            const determiner = options.determiner || 'the';
            parts.push(`${determiner} ${pluralName}`);
        }
    }

    // Join the parts with correct grammar (commas and "and")
    if (parts.length === 1) {
        return parts[0];
    } else if (parts.length === 2) {
        return parts.join(' and ');
    } else {
        return parts.slice(0, -1).join(', ') + ', and ' + parts.slice(-1);
    }
}

export function countMonsters(horde, condition = "all", gameData) {
    return Object.entries(horde)
        .filter(([type, monsters]) => {
            // Skip empty arrays always
            if (!monsters.length) return false;

            // Handle conditions
            if (condition === "all") return true;

            const specials = gameData.monsters[type].behavior.special || [];
            if (condition === "lingers_long") {
                return specials.includes("lingers_long");
            }
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