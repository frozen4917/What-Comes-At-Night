# 🌙 What Comes At Night

> Minimalist Survival Horror. 50 Turns. One Goal: Survive until Dawn.

**What Comes At Night** is a minimalist, text-based survival horror game. Stranded in a remote campsite, you must endure a single, harrowing night against escalating supernatural threats. Master turn-based strategy and resource management to survive 50 turns against the supernatural until dawn.

---

## 🎮 Game Overview

### Gameplay
* **The Setup:** The sun has set. You're alone at the campsite with limited time to prepare.
* **Three Vital Stats:** Manage **Health**, **Stamina**, and **Noise** to survive.
* **Scavenge & Fortify:** Search woods and structures for weapons, food, and materials. Build fortifications against attacks.
* **The Noise System:** Every action generates noise. High noise attracts lone monsters. Rest or hide to reduce detection.
* **Timed Hordes:** At key phases, waves of Zombies, Skeletons, and boss monsters attack. Your preparation will be tested.
* **7 Phases, 50 Actions:** Progress from Dusk through The Witching Hour to Dawn. Each phase increases difficulty.

### How To Play
The game is turn-based. Every decision you make counts as one action. You have to survive for 50 actions.

1. **Interface**
    - **Stats Bar (Top):** Monitor your Health, Stamina, Fortification and Noise here. You can find the current phase, actions left in the current phase, your location, and most importantly, the number of monsters here.
    - **Story Log (Middle):** This is the main story text. It updates every turn and tells you what has happened, what you have found, and what is about to take your life.
    - **Action Menu (Bottom):** These are your controls.
        - **Left Column:** Select your category, e.g. **MOVE**, **ATTACK**, etc.
        - **Right Column:** Select a specific Action to perform. If you are curious, the tooltip on the far right will guide you on what a specific action will do.
    - **Footer:** Additional options
        - **Show Inventory:** Look at all the items you have leftover in your inventory.
        - **Options:** Change volume, in case the music is too loud.
        - **Restart Game:** Resets the game.
2. **Taking Action**
    - As a turn-based game, time progresses only after an action is performed.
    - Clicking an action immediately performs it. Your stats update, time ticks forward, and the world reacts.
    - Check the details using the tooltip on the right if you are not sure what an action does. It would be a shame if you fortify your gate only to realise you ran out of stamina.
3. **Managing Survival**
    - **Stamina:** Most actions require stamina. If you run out of Stamina, you can't work or fight. Use Rest actions to recover.
    - **Health:** Monsters can and will attack you and bring your health down. If your health ever reaches zero, you lose. Healing and eating can help recover health.
    - **Noise:** Scavenging and building make noise. If your Noise level gets too high, you will attract wandering monsters. Use Hide actions to stay quiet.
    - **Fortification HP:** Monsters will try to break into your location. Use Wood to fortify the gates and doors. A strong wall can save your life when a horde attacks.
4. **Monsters**
    - Lone monsters are attracted by noise. Should you kill them quickly, or should you hide? That is a choice for you to make.
    - Hordes, consisting of multiple monsters, start appearing after Nightfall. You cannot hide from them. You must fight!
    - Boss monsters could appear. They are stronger, better, and can perform special attacks! Take them out fast!
---

## 🛠️ Technical Highlights

### Key Features

* **Fully Data-Driven:** The entire game balance: monsters, items, loot tables, text, and settings, all are defined in external JSON files, making it easy to rebalance.
* **Reactive UI:** Built with **Vue 3** and **Pinia** for instant, reactive state management.
* **Immersive Audio:** Features a dynamic audio system using **Howler.js** that crossfades music tracks based on the game phase.
* **Mobile-Responsive Design:** A responsive, "app-like" layout that works perfectly on desktop and mobile devices.
* **State Persistence:** The game automatically saves progress to `localStorage` after every move.
* **Phase-Based Theming:** CSS variables dynamically shift accent colors (orange → purple → blue → red) as night progresses

### Tech Stack

| Category | Technology |
|----------|-----------|
| **Framework** | [Vue 3](https://vuejs.org/) |
| **State Management** | [Pinia](https://pinia.vuejs.org/) |
| **Build Tool** | [Vite](https://vitejs.dev/) |
| **Audio** | [Howler.js](https://howlerjs.com/) |
| **Styling** | Custom CSS with Grid layout + CSS Variables |
| **Fonts** | Google Fonts (Special Elite, Roboto Condensed) |

### Getting Started

This project requires **Node.js** (v22.x or higher recommended).

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/frozen4917/what-comes-at-night.git
    cd what-comes-at-night
    ```

2.  **Install dependencies:**
    ```sh
    npm install
    ```

3.  **Run the development server:**
    ```sh
    npm run dev
    ```

4.  **Build for production:**
    ```sh
    npm run build
    ```
    The build artifacts will be stored in the `dist/` directory.

### Project Architecture

The codebase follows a strict **Engine vs. Controller** separation of concerns:

#### 1. The Database (`public/data/`)
Contains all static game data. This ibehaves as the "Rulebook."
* `items.json`: Definitions for all items, weapons, and crafting recipes.
* `monsters.json`: Stats and behaviors for all enemies.
* `locations.json`: Defines the map, available actions, and loot.
* `settings.json`: Global configuration for game balance (damage multipliers, spawn rates).
* ... etc.

#### 2. The Engine (`src/game/`)
Pure JavaScript logic that calculates the game state. It knows nothing about the UI.
* `main.js`: Orchestrates the core game loop (Player Turn -> Monster Turn).
* `monsterHandler.js`: Handles AI logic, horde spawning, and damage calculations.
* `effectsHandler.js`: Processes the results of player actions (crafting, healing, attacking).
* ... etc.

#### 3. The Controller (`src/stores/gameStore.js`)
The Pinia store that connects the Engine to the View.
* Manages the reactive `gameState`.
* Persists data to `localStorage`.
* Handles audio triggers.

#### 4. The View (`src/components/`)
Vue components that display the state.
* `layout/`: Core UI panels (StatsBar, ActionMenu, ContentDisplay).
* `overlays/`: Modal windows (Inventory, Options, Game Over).


---

## 📋 Future Plans
Here are some planned ideas for *What Comes At Night*

- [ ] Implement a full SFX system (footsteps, combat sounds, UI clicks) to match the atmospheric music.
- [ ] Add item descriptions in the inventory overlay.
- [ ] Add random events to keep runs unpredictable and encourage replayability and strategy-rethinking.