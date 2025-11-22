<script setup>
import { useGameStore } from '@/stores/gameStore';
const gameStore = useGameStore();
</script>

<template>
    <div id="how-to-play-overlay" class="overlay">
        <div class="overlay-content">
            <h2>Survival Guide</h2>
            
            <div class="guide-text">
                <p class="intro">
                    The night is long. You must survive <strong>50 turns</strong> until dawn.
                    Every decision counts.
                </p>

                <h3>Game Interface</h3>
                <ul>
                    <li>
                        <strong class="point">Stats Bar (Top):</strong> Monitor Health, Stamina, Fortification, and Noise here. You can find the current phase, the actions left in the current phase, your location, and the number of monsters here.
                    </li>
                    <li>
                        <strong class="point">Story Log (Middle):</strong> This is the main story text. It updates every turn and tells you about what has happened, what you have found, and what is about to take your life. Read it carefully.
                    </li>
                    <li><strong class="point">Action Menu (Bottom):</strong> These are your controls.
                        <ul>
                            <li>
                                <span class="subpoint">Category (Left):</span> Select your category, e.g. MOVE, ATTACK, etc. Each category has different actions.
                            </li>
                            <li>
                                <span class="subpoint">Actions (Right):</span> Select a specific action here. Clicking an action immediately triggers it.
                            </li>
                            <li>
                                <span class="subpoint">Tooltip (ⓘ):</span> If you are ever confused, click the tooltip button on the far right of a specific action to figure out what it costs and what effects it has.
                            </li>
                        </ul>
                    </li>
                    <li>
                        <strong class="point">Footer: </strong> Contains additional options
                        <ul>
                            <li>
                                <span class="subpoint">Show Inventory:</span> Look at the items you have remaining in your inventory.
                            </li>
                            <li>
                                <span class="subpoint">Options:</span> Control the volume and enable/disable the text highlighting.
                            </li>
                            <li>
                                <span class="subpoint">Main Menu:</span> Return to the main menu.
                            </li>
                        </ul>
                    </li>
                </ul>

                <h3>Survival Mechanics</h3>
                <ul>
                    <li>
                        <strong class="point">Stamina:</strong> Almost every action costs stamina. Rest to recover. If you run out, you cannot work or fight.
                    </li>
                    <li>
                        <strong class="point">Health:</strong> Monsters can and will attack you. If this hits zero, you die. Heal using Bandages or Food.
                    </li>
                    <li>
                        <strong class="point">Noise:</strong> Scavenging and building make noise. High noise attracts lone monsters. Hide to reduce noise.
                    </li>
                    <li>
                        <strong class="point">Fortifications:</strong> Build walls to protect yourself. A strong gate can save you when the Horde attacks.
                    </li>
                </ul>

                <h3>Gameplay</h3>
                <ul>
                    <li>Select a category and an action. Each action advances the clock.</li>
                    <li>After you act, the game updates. Monsters may spawn, move closer, or attack your fortifications depending on the Noise you made.</li>
                    <li>Read the text log carefully. It tells you what you found, if your defenses held, if you took damage, or if new threats have emerged.</li>
                </ul>

                <h3>The Monsters</h3>
                <ul>
                    <li>
                        <strong class="point">Lone Monsters:</strong> Attracted by noise. You can kill them or hide from them.
                    </li>
                    <li>
                        <strong class="point">The Horde:</strong> Appears in each phase from Nightfall onwards. You cannot hide. You must fight or tank the damage.
                    </li>
                    <li>
                        <strong class="point">Bosses:</strong> Stronger enemies with special abilities. Kill them quickly before they overwhelm you.
                    </li>
                </ul>

                <h3>Phases</h3>
                <ul>
                    <li>The game is composed of 50 moves spread across 7 phases.
                        <ul>
                            <li><span class="dusk">Dusk</span> and <span class="evening">Evening</span> are the exploration phases. Use this time to scavenge for resources and fortify your defenses. Be careful, if you create too much noise, lone monsters might wander towards you.</li>
                            <li><span class="nightfall">Nightfall</span> and <span class="deep_night">Deep Night</span> are the phases when darkness takes over. Small hordes will begin to spawn. You cannot hide from them!</li>
                            <li><span class="witching_hour">The Witching Hour</span> is the peak of the night. A massive horde, led by a boss monster will attack. Your preparations will be tested.</li>
                            <li><span class="pre_dawn">Pre-Dawn</span> is the final stretch as the sun begins to rise. Survive for a few more moves until <span class="dawn">Dawn</span> to win.</li>
                        </ul>
                    </li>
                </ul>
            </div>
            <!-- Back button -->
            <button class="footer-button close-button" @click="gameStore.toggleHowToPlay()">
                Back to Menu
            </button>
        </div>
    </div>
</template>

<style scoped>
.overlay {
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 3000; /* Higher than Main Menu */
}

.overlay-content {
    max-width: 65rem; /* Wider than standard overlays for reading */
    max-height: 80vh; /* Allow scrolling */
    overflow-y: auto;
    text-align: left;
    padding-right: 1.5rem; /* Space for scrollbar */
}

/* Large heading */
h2 {
    text-align: center;
    margin-bottom: 2rem;
}

/* Subheadings */
h3 {
    color: var(--accent-color);
    font-family: 'Roboto Condensed', sans-serif;
    text-transform: uppercase;
    margin-top: 2.5rem;
    margin-bottom: 1rem;
    border-bottom: 1px solid #333;
    padding-bottom: 0.5rem;
}

.intro {
    font-size: 1.7rem;
    font-style: italic;
    text-align: center;
    margin-bottom: 2rem;
}

ul {
    font-size: 1.5rem;
    list-style-type: disc;
    padding-left: 2rem;
    margin-bottom: 1.5rem;
}

li {
    margin-bottom: 1rem;
    line-height: 1.6;
}

.point {
    color: var(--accent-color);
}
.subpoint {
    color: var(--accent-color);
}

/* Colours for phase texts */
.dusk { color: #e08666; font-weight: bold; }
.evening { color: #8c76ab; font-weight: bold; }
.nightfall { color: #5876a6; font-weight: bold; }
.deep_night { color: #3e4f8f; font-weight: bold; }
.witching_hour { color: #b91c1c; font-weight: bold; }
.pre_dawn { color: #add8e6; font-weight: bold; }
.dawn { color: #ffefba; font-weight: bold; }
</style>