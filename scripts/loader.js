import promptSync from "prompt-sync";
import chalk from "chalk";
const prompt = promptSync({ sigint: true });
import path from 'path';
import { promises as fs } from 'fs';

/**
 * Loads game-related data
 * @returns {Object} gameData object comprising of all game data
 */
export async function loadGameData() {
    console.log(chalk.yellow("Loading all game data..."));

    // All data files
    const fileNames = [
        'globalActions.json',
        'initialState.json',
        'items.json',
        'locations.json',
        'monsters.json',
        'phases.json',
        'texts.json'
    ];

    try {
        const filePromises = fileNames.map(async (fileName) => {
            const filePath = path.join('./data', fileName);
            const fileContent = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(fileContent);

            return {
                name: path.parse(fileName).name,
                data: data
            };
        });

        const loadedDataArray = await Promise.all(filePromises);

        const gameData = loadedDataArray.reduce((acc, current) => {
            acc[current.name] = current.data;
            return acc;
        }, {});

        console.log(chalk.yellow("Game data loaded successfully!"));
        prompt("> ");
        return gameData; // Returns the actual gameData object

    } catch (error) {
        // If any file is missing or has a JSON error, the game will stop
        console.error(chalk.red("FATAL ERROR: Could not load game data. Check your JSON files."));
        console.error(error);
        process.exit(1); // Exits the game.
    }
}