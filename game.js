export class Game {
    constructor() {
        this.state = null;
        this.onStateChanged = () => {};
        this.onGameWon = () => {};
        this.initializeState();
    }

    initializeState() {
        this.state = {
            stock: [],
            waste: [],
            foundations: [[], [], [], []],
            tableau: [[], [], [], [], [], [], []],
        };
    }

    start() {
        this.initializeState();
        const deck = this.createDeck();
        this.shuffle(deck);
        this.deal(deck);
        this.onStateChanged(this.state);
    }

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
                    isFaceUp: false,
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

    deal(deck) {
        // Deal to tableau
        for (let i = 0; i < 7; i++) {
            for (let j = i; j < 7; j++) {
                this.state.tableau[j].push(deck.pop());
            }
        }

        // Flip top card of each tableau pile
        this.state.tableau.forEach(pile => {
            if (pile.length > 0) {
                pile[pile.length - 1].isFaceUp = true;
            }
        });

        // Remaining cards go to stock
        this.state.stock = deck;
    }

    handleCardClick(cardId, pileName) {
        const [type, index] = pileName.split('-');

        if (type === 'stock') {
            this.dealFromStock();
        } else if (type === 'tableau') {
            const pile = this.state.tableau[index];
            const card = pile.find(c => c.id === cardId);
            if (card && !card.isFaceUp && card === pile[pile.length - 1]) {
                this.flipTableauCard(pile);
            }
        }
    }
    
    flipTableauCard(pile) {
        if (pile.length > 0) {
            const topCard = pile[pile.length - 1];
            if (!topCard.isFaceUp) {
                topCard.isFaceUp = true;
                this.onStateChanged(this.state);
                return true;
            }
        }
        return false;
    }

    dealFromStock() {
        if (this.state.stock.length > 0) {
            const card = this.state.stock.pop();
            card.isFaceUp = true;
            this.state.waste.push(card);
        } else if (this.state.waste.length > 0) {
            // Restock
            this.state.stock = this.state.waste.reverse().map(c => ({...c, isFaceUp: false}));
            this.state.waste = [];
        }
        this.onStateChanged(this.state);
    }
    
    getCardAndPile(cardId) {
        for (const pileType of ['stock', 'waste', 'foundations', 'tableau']) {
            if (pileType === 'foundations' || pileType === 'tableau') {
                for (let i = 0; i < this.state[pileType].length; i++) {
                    const pile = this.state[pileType][i];
                    const cardIndex = pile.findIndex(c => c.id === cardId);
                    if (cardIndex > -1) {
                        return { card: pile[cardIndex], pile, pileName: `${pileType}-${i}`, cardIndex };
                    }
                }
            } else {
                 const pile = this.state[pileType];
                 const cardIndex = pile.findIndex(c => c.id === cardId);
                 if (cardIndex > -1) {
                     return { card: pile[cardIndex], pile, pileName: `${pileType}-0`, cardIndex };
                 }
            }
        }
        return { card: null, pile: null, pileName: null, cardIndex: -1 };
    }

    moveCards(cardIds, targetPileName) {
        if (cardIds.length === 0) return false;
        
        const firstCardId = cardIds[0];
        const { card: firstCard, pile: sourcePile, pileName: sourcePileName } = this.getCardAndPile(firstCardId);
        
        if (!firstCard || !this.isValidMove(firstCard, cardIds, targetPileName)) {
            return false;
        }

        const cardsToMove = [];
        cardIds.forEach(id => {
            const index = sourcePile.findIndex(c => c.id === id);
            if (index > -1) {
                cardsToMove.push(...sourcePile.splice(index, 1));
            }
        });
        
        const [targetType, targetIndex] = targetPileName.split('-');
        let targetPile;
        if (targetType === 'foundation') targetPile = this.state.foundations[targetIndex];
        else if (targetType === 'tableau') targetPile = this.state.tableau[targetIndex];

        targetPile.push(...cardsToMove);

        // Flip new top card in source tableau if necessary
        const [sourceType] = sourcePileName.split('-');
        if (sourceType === 'tableau' && sourcePile.length > 0) {
            sourcePile[sourcePile.length - 1].isFaceUp = true;
        }

        this.onStateChanged(this.state);
        this.checkWinCondition();
        return true;
    }

    isValidMove(card, cardIds, targetPileName) {
        const [targetType, targetIndex] = targetPileName.split('-');
        
        if (targetType === 'foundation') {
            if (cardIds.length > 1) return false; // Can only move one card to foundation
            const foundationPile = this.state.foundations[targetIndex];
            if (foundationPile.length === 0) {
                return card.value === 1; // Must be an Ace
            } else {
                const topCard = foundationPile[foundationPile.length - 1];
                return card.suit === topCard.suit && card.value === topCard.value + 1;
            }
        } else if (targetType === 'tableau') {
            const tableauPile = this.state.tableau[targetIndex];
            if (tableauPile.length === 0) {
                return card.value === 13; // Must be a King
            } else {
                const topCard = tableauPile[tableauPile.length - 1];
                return card.color !== topCard.color && card.value === topCard.value - 1;
            }
        }
        return false;
    }

    checkWinCondition() {
        const totalCardsInFoundations = this.state.foundations.reduce((sum, pile) => sum + pile.length, 0);
        if (totalCardsInFoundations === 52) {
            this.onGameWon();
        }
    }
}

