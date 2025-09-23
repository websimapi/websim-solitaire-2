import { Game } from './game.js';
import { UI } from './ui.js';
import { Drag } from './drag.js';
import { Sound } from './sound.js';

document.addEventListener('DOMContentLoaded', () => {
    const gameContainer = document.getElementById('game-container');
    const newGameBtn = document.getElementById('new-game-btn');
    const autoWinBtn = document.getElementById('auto-win-btn');
    const winNewGameBtn = document.getElementById('win-new-game-btn');

    let game, ui, drag, sound;

    function handleAutoPlay() {
        if (game.autoPlayToFoundations()) {
            sound.play('place');
        } else {
            sound.play('invalid');
        }
    }

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
            drag.addCardListeners();
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
    autoWinBtn.addEventListener('click', handleAutoPlay);
    winNewGameBtn.addEventListener('click', () => {
        ui.hideWinScreen();
        startNewGame();
    });

    gameContainer.addEventListener('dblclick', (e) => {
        if (e.target === gameContainer || e.target.id === 'tableau') {
             handleAutoPlay();
        }
    });

    // Handle stock clicks
    gameContainer.addEventListener('click', (e) => {
        const stockPile = e.target.closest('.stock-pile');
        // Only handle clicks on the empty stock pile itself, card clicks are handled elsewhere
        if (stockPile && e.target === stockPile) {
            game.dealFromStock();
            sound.play('deal');
        }
    });

    // Prevent context menu on long press on mobile
    window.addEventListener('contextmenu', e => e.preventDefault());

    startNewGame();
});