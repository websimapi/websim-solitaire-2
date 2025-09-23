import { Game } from './game.js';
import { UI } from './ui.js';
import { Drag } from './drag.js';
import { Sound } from './sound.js';

document.addEventListener('DOMContentLoaded', () => {
    const gameContainer = document.getElementById('game-container');
    const newGameBtn = document.getElementById('new-game-btn');
    const winNewGameBtn = document.getElementById('win-new-game-btn');

    let game, ui, drag, sound;

    function startNewGame() {
        if (ui) {
            ui.clearBoard();
        }
        
        sound = new Sound();
        game = new Game();
        ui = new UI(game.state);
        drag = new Drag(game, ui, sound);

        game.onStateChanged = (newState) => {
            ui.render(newState);
            drag.makeCardsDraggable();
        };

        game.onGameWon = () => {
            sound.play('win');
            ui.showWinScreen();
            const winCards = document.querySelectorAll('#foundations .card');
            ui.animateWin(Array.from(winCards));
        };
        
        game.start();
        sound.play('shuffle');
    }

    newGameBtn.addEventListener('click', startNewGame);
    winNewGameBtn.addEventListener('click', () => {
        ui.hideWinScreen();
        startNewGame();
    });

    // Prevent context menu on long press on mobile
    window.addEventListener('contextmenu', e => e.preventDefault());

    startNewGame();
});

