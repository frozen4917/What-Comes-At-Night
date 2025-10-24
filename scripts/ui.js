import chalk from "chalk";

import { loadGameData } from './loader.js';

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