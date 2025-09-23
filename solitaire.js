
```javascript
// Comprehensive Solitaire Game Implementation
class SolitaireGame {
    constructor() {
        this.state = {
            stock: [],
            waste: [],
            foundations: [[], [], [], []],
            tableau: [[], [], [], [], [], [], []]
        };

        this.isDragging = false;
        this.dragState = {
            cards: [],
            elements: [],
            startX: 0,
            startY: 0,
            offsetX: 0,
            offsetY: 0
        };

        this.sounds = {};
        this.init();
    }

    init() {
        this.loadSounds();
        this.setupEventListeners();
        this.newGame();
    }

    // Sound Management
    async loadSounds() {
        const soundFiles = {
            deal: 'sound-deal.mp3',
            place: 'sound-place.mp3',
            invalid: 'sound-invalid.mp3',
            win: 'sound-win.mp3',
            shuffle: 'sound-shuffle.mp3'
        };

        for (const [name, file] of Object.entries(soundFiles)) {
            try {
                const audio = new Audio(file);
                audio.preload = 'auto';
                this.sounds[name] = audio;
            } catch (e) {
                console.warn(`Failed to load sound: ${name}`);
            }
        }
    }

    playSound(name) {
        if (this.sounds[name]) {
            this.sounds[name].currentTime = 0;
            this.sounds[name].play().catch(() => {});
        }
    }

    // Game Logic
    createDeck() {
        const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
        const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const deck = [];

        for (const suit of suits) {
            for (let i = 0; i < ranks.length; i++) {
                deck.push({
                    suit,
                    rank: ranks[i],
                    value: i + 1,
                    color: (suit === 'hearts' || suit === 'diamonds') ? 'red' : 'black',
                    faceUp: false,
                    id: `${ranks[i]}-${suit}`
                });
            }
        }
        return deck;
    }

    shuffle(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    }

    newGame() {
        // Reset state
        this.state = {
            stock: [],
            waste: [],
            foundations: [[], [], [], []],
            tableau: [[], [], [], [], [], [], []]
        };

        // Create and shuffle deck
        const deck = this.createDeck();
        this.shuffle(deck);

        // Deal tableau
        for (let col = 0; col < 7; col++) {
            for (let row = col; row < 7; row++) {
                const card = deck.pop();
                if (row === col) card.faceUp = true; // Top card face up
                this.state.tableau[row].push(card);
            }
        }

        // Remaining cards to stock
        this.state.stock = deck;

        this.render();
        this.playSound('shuffle');
    }

    // Card Movement Validation
    canPlaceOnFoundation(card, foundationIndex) {
        const foundation = this.state.foundations[foundationIndex];
        if (foundation.length === 0) {
            return card.value === 1; // Ace
        }
        const topCard = foundation[foundation.length - 1];
        return card.suit === topCard.suit && card.value === topCard.value + 1;
    }

    canPlaceOnTableau(card, tableauIndex) {
        const tableau = this.state.tableau[tableauIndex];
        if (tableau.length === 0) {
            return card.value === 13; // King
        }
        const topCard = tableau[tableau.length - 1];
        return card.color !== topCard.color && card.value === topCard.value - 1;
    }

    isValidSequence(cards) {
        for (let i = 1; i < cards.length; i++) {
            const prev = cards[i - 1];
            const curr = cards[i];
            if (prev.color === curr.color || prev.value !== curr.value + 1) {
                return false;
            }
        }
        return true;
    }

    // Game Actions
    dealFromStock() {
        if (this.state.stock.length > 0) {
            const card = this.state.stock.pop();
            card.faceUp = true;
            this.state.waste.push(card);
            this.playSound('deal');
        } else if (this.state.waste.length > 0) {
            // Reset stock
            this.state.stock = this.state.waste.reverse();
            this.state.stock.forEach(card => card.faceUp = false);
            this.state.waste = [];
            this.playSound('deal');
        }
        this.render();
    }

    moveCards(cards, targetPile, targetIndex = null) {
        // Find source pile and remove cards
        let sourcePile = null;
        let sourceIndex = null;

        // Find source
        if (this.state.waste.includes(cards[0])) {
            sourcePile = this.state.waste;
        } else {
            for (let i = 0; i < 4; i++) {
                if (this.state.foundations[i].includes(cards[0])) {
                    sourcePile = this.state.foundations[i];
                    sourceIndex = i;
                    break;
                }
            }
            if (!sourcePile) {
                for (let i = 0; i < 7; i++) {
                    if (this.state.tableau[i].includes(cards[0])) {
                        sourcePile = this.state.tableau[i];
                        sourceIndex = i;
                        break;
                    }
                }
            }
        }

        if (!sourcePile) return false;

        // Validate move
        let valid = false;
        if (targetPile === 'foundation') {
            valid = cards.length === 1 && this.canPlaceOnFoundation(cards[0], targetIndex);
        } else if (targetPile === 'tableau') {
            valid = this.canPlaceOnTableau(cards[0], targetIndex) && this.isValidSequence(cards);
        }

        if (!valid) {
            this.playSound('invalid');
            return false;
        }

        // Remove cards from source
        const startIndex = sourcePile.indexOf(cards[0]);
        sourcePile.splice(startIndex, cards.length);

        // Add to target
        if (targetPile === 'foundation') {
            this.state.foundations[targetIndex].push(...cards);
        } else if (targetPile === 'tableau') {
            this.state.tableau[targetIndex].push(...cards);
        }

        // Flip card if needed
        if (sourcePile === this.state.tableau[sourceIndex] && sourcePile.length > 0) {
            const topCard = sourcePile[sourcePile.length - 1];
            if (!topCard.faceUp) {
                topCard.faceUp = true;
                this.playSound('deal');
            }
        }

        this.playSound('place');
        this.render();
        this.checkWin();
        return true;
    }

    autoMove(card) {
        // Try to move to foundation
        for (let i = 0; i < 4; i++) {
            if (this.canPlaceOnFoundation(card, i)) {
                return this.moveCards([card], 'foundation', i);
            }
        }
        return false;
    }

    checkWin() {
        const totalCards = this.state.foundations.reduce((sum, pile) => sum + pile.length, 0);
        if (totalCards === 52) {
            this.showWinScreen();
            this.playSound('win');
        }
    }

    // UI Rendering
    render() {
        this.clearBoard();
        this.renderStock();
        this.renderWaste();
        this.renderFoundations();
        this.renderTableau();
        this.attachEventListeners();
    }

    clearBoard() {
        document.querySelectorAll('.pile').forEach(pile => {
            pile.innerHTML = '';
            pile.classList.remove('empty');
        });
    }

    renderStock() {
        const stockElement = document.querySelector('[data-pile="stock"]');
        if (this.state.stock.length === 0) {
            stockElement.classList.add('empty');
        } else {
            const card = this.createCardElement(this.state.stock[this.state.stock.length - 1], 0);
            stockElement.appendChild(card);
        }
    }

    renderWaste() {
        const wasteElement = document.querySelector('[data-pile="waste"]');
        this.state.waste.forEach((card, index) => {
            const cardElement = this.createCardElement(card, index);
            wasteElement.appendChild(cardElement);
        });
    }

    renderFoundations() {
        this.state.foundations.forEach((pile, index) => {
            const foundationElement = document.querySelector(`[data-pile="foundation-${index}"]`);
            pile.forEach((card, cardIndex) => {
                const cardElement = this.createCardElement(card, cardIndex);
                foundationElement.appendChild(cardElement);
            });
        });
    }

    renderTableau() {
        this.state.tableau.forEach((pile, index) => {
            const tableauElement = document.querySelector(`[data-pile="tableau-${index}"]`);
            pile.forEach((card, cardIndex) => {
                const cardElement = this.createCardElement(card, cardIndex);
                tableauElement.appendChild(cardElement);
            });
        });
    }

    createCardElement(card, index) {
        const cardEl = document.createElement('div');
        cardEl.className = `card ${card.faceUp ? '' : 'is-flipped'}`;
        cardEl.dataset.id = card.id;
        cardEl.dataset.rank = card.rank;
        cardEl.dataset.suit = card.suit;
        cardEl.dataset.color = card.color;
        cardEl.style.setProperty('--card-index', index);

        const cardInner = document.createElement('div');
        cardInner.className = 'card-inner';

        // Front face
        const cardFront = document.createElement('div');
        cardFront.className = 'card-front';
        cardFront.innerHTML = `
            <div class="top-left">
                <div class="card-value">${card.rank}</div>
                <div class="card-suit"><img src="icon-${card.suit}.png" alt="${card.suit}"></div>
            </div>
            <div class="bottom-right">
                <div class="card-value">${card.rank}</div>
                <div class="card-suit"><img src="icon-${card.suit}.png" alt="${card.suit}"></div>
            </div>
        `;

        // Back face
        const cardBack = document.createElement('div');
        cardBack.className = 'card-back';

        cardInner.appendChild(cardFront);
        cardInner.appendChild(cardBack);
        cardEl.appendChild(cardInner);

        return cardEl;
    }

    // Event Handling
    setupEventListeners() {
        // New game button
        document.getElementById('new-game-btn').addEventListener('click', () => this.newGame());

        // Auto play button
        document.getElementById('auto-win-btn').addEventListener('click', () => this.autoPlay());

        // Win screen
        document.getElementById('win-new-game-btn').addEventListener('click', () => {
            this.hideWinScreen();
            this.newGame();
        });

        // Stock pile click
        document.addEventListener('click', (e) => {
            if (e.target.closest('[data-pile="stock"]') && !this.isDragging) {
                this.dealFromStock();
            }
        });
    }

    attachEventListeners() {
        document.querySelectorAll('.card').forEach(card => {
            // Double tap for auto-move
            let lastTap = 0;
            card.addEventListener('click', (e) => {
                const currentTime = new Date().getTime();
                const tapLength = currentTime - lastTap;
                if (tapLength < 500 && tapLength > 0) {
                    this.handleDoubleClick(card);
                }
                lastTap = currentTime;
            });

            // Drag handling
            card.addEventListener('pointerdown', (e) => this.startDrag(e, card));
        });
    }

    handleDoubleClick(cardElement) {
        const cardId = cardElement.dataset.id;
        const card = this.findCard(cardId);
        if (card && card.faceUp) {
            this.autoMove(card);
        }
    }

    // Drag and Drop
    startDrag(e, cardElement) {
        if (e.button !== 0) return;
        e.preventDefault();

        const cardId = cardElement.dataset.id;
        const card = this.findCard(cardId);
        if (!card || !card.faceUp) return;

        // Determine draggable cards
        const draggableCards = this.getDraggableCards(card);
        if (draggableCards.length === 0) return;

        this.dragState.cards = draggableCards;
        this.dragState.elements = draggableCards.map(c => document.querySelector(`[data-id="${c.id}"]`));

        const rect = cardElement.getBoundingClientRect();
        this.dragState.offsetX = e.clientX - rect.left;
        this.dragState.offsetY = e.clientY - rect.top;
        this.dragState.startX = e.clientX;
        this.dragState.startY = e.clientY;

        document.addEventListener('pointermove', this.handleDragMove.bind(this));
        document.addEventListener('pointerup', this.handleDragEnd.bind(this), { once: true });
    }

    handleDragMove(e) {
        if (!this.isDragging) {
            const dx = e.clientX - this.dragState.startX;
            const dy = e.clientY - this.dragState.startY;
            if (Math.sqrt(dx * dx + dy * dy) > 10) {
                this.isDragging = true;
                this.dragState.elements.forEach((el, i) => {
                    el.classList.add('dragging');
                    el.style.zIndex = 1000 + i;
                });
            }
        }

        if (this.isDragging) {
            this.updateDragPosition(e.clientX, e.clientY);
            this.updateDropTarget(e.clientX, e.clientY);
        }
    }

    updateDragPosition(x, y) {
        const visibleOverlap = 20; // Simplified overlap
        this.dragState.elements.forEach((el, i) => {
            const posX = x - this.dragState.offsetX;
            const posY = y - this.dragState.offsetY + (i * visibleOverlap);
            el.style.transform = `translate(${posX}px, ${posY}px)`;
        });
    }

    updateDropTarget(x, y) {
        // Clear previous highlights
        document.querySelectorAll('.pile').forEach(p => {
            p.classList.remove('drop-valid', 'drop-invalid');
        });

        // Find drop target
        this.dragState.elements.forEach(el => el.style.pointerEvents = 'none');
        const dropTarget = document.elementFromPoint(x, y)?.closest('.pile');
        this.dragState.elements.forEach(el => el.style.pointerEvents = 'auto');

        if (dropTarget) {
            const pileName = dropTarget.dataset.pile;
            const [pileType, index] = pileName.split('-');

            let valid = false;
            if (pileType === 'foundation' && this.dragState.cards.length === 1) {
                valid = this.canPlaceOnFoundation(this.dragState.cards[0], parseInt(index));
            } else if (pileType === 'tableau') {
                valid = this.canPlaceOnTableau(this.dragState.cards[0], parseInt(index));
            }

            dropTarget.classList.add(valid ? 'drop-valid' : 'drop-invalid');
        }
    }

    handleDragEnd(e) {
        document.removeEventListener('pointermove', this.handleDragMove.bind(this));

        if (this.isDragging) {
            // Find drop target
            this.dragState.elements.forEach(el => el.style.pointerEvents = 'none');
            const dropTarget = document.elementFromPoint(e.clientX, e.clientY)?.closest('.pile');
            this.dragState.elements.forEach(el => el.style.pointerEvents = 'auto');

            let moved = false;
            if (dropTarget) {
                const pileName = dropTarget.dataset.pile;
                const [pileType, index] = pileName.split('-');
                moved = this.moveCards(this.dragState.cards, pileType, parseInt(index));
            }

            if (!moved) {
                this.render(); // Reset positions
            }
        }

        // Reset drag state
        this.dragState.elements.forEach(el => {
            el.classList.remove('dragging');
            el.style.zIndex = '';
            el.style.transform = '';
        });

        document.querySelectorAll('.pile').forEach(p => {
            p.classList.remove('drop-valid', 'drop-invalid');
        });

        this.isDragging = false;
        this.dragState = { cards: [], elements: [], startX: 0, startY: 0, offsetX: 0, offsetY: 0 };
    }

    getDraggableCards(card) {
        // Find which pile the card is in and what cards can be dragged
        if (this.state.waste.includes(card)) {
            return this.state.waste.slice(-1); // Only top card
        }

        for (let i = 0; i < 4; i++) {
            const foundation = this.state.foundations[i];
            if (foundation.includes(card)) {
                return foundation.slice(-1); // Only top card
            }
        }

        for (let i = 0; i < 7; i++) {
            const tableau = this.state.tableau[i];
            const cardIndex = tableau.indexOf(card);
            if (cardIndex >= 0) {
                const sequence = tableau.slice(cardIndex);
                if (sequence.every(c => c.faceUp) && this.isValidSequence(sequence)) {
                    return sequence;
                }
            }
        }

        return [];
    }

    findCard(cardId) {
        const allCards = [
            ...this.state.stock,
            ...this.state.waste,
            ...this.state.foundations.flat(),
            ...this.state.tableau.flat()
        ];
        return allCards.find(card => card.id === cardId);
    }

    autoPlay() {
        let moved = false;

        // Try waste pile
        if (this.state.waste.length > 0) {
            moved = this.autoMove(this.state.waste[this.state.waste.length - 1]) || moved;
        }

        // Try tableau tops
        for (const pile of this.state.tableau) {
            if (pile.length > 0) {
                const topCard = pile[pile.length - 1];
                if (topCard.faceUp) {
                    moved = this.autoMove(topCard) || moved;
                }
            }
        }

        if (!moved) {
            this.playSound('invalid');
        }
    }

    showWinScreen() {
        document.getElementById('win-screen').classList.remove('hidden');
    }

    hideWinScreen() {
        document.getElementById('win-screen').classList.add('hidden');
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SolitaireGame();
});