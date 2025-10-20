import promptSync from "prompt-sync";
import chalk from "chalk";
const prompt = promptSync({ sigint: true });
import path from 'path';
import { promises as fs } from 'fs';

export async function loadGameData() { // Call in main.js
    console.log(chalk.yellow("Loading all game data..."));

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

            // Return an object with the name (without .json) and the data.
            // e.g., { name: 'monsters', data: { ... } }
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
        return gameData;

    } catch (error) {
        // If any file is missing or has a JSON error, the game will stop
        // and tell you exactly what went wrong.
        console.error(chalk.red("FATAL ERROR: Could not load game data. Check your JSON files."));
        console.error(error);
        process.exit(1); // Exits the application.
    }
}