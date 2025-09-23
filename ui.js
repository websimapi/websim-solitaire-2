export class UI {
    constructor(initialState) {
        this.suitSymbols = {
            hearts: 'icon-heart.png',
            diamonds: 'icon-diamond.png',
            clubs: 'icon-club.png',
            spades: 'icon-spade.png',
        };
        this.gameContainer = document.getElementById('game-container');
        this.render(initialState);
    }

    clearBoard() {
        const piles = document.querySelectorAll('.pile');
        piles.forEach(pile => pile.innerHTML = '');
    }

    render(state) {
        this.clearBoard();

        this.renderPile(state.stock, 'stock');
        this.renderPile(state.waste, 'waste');
        state.foundations.forEach((pile, i) => this.renderPile(pile, `foundation-${i}`));
        state.tableau.forEach((pile, i) => this.renderPile(pile, `tableau-${i}`));
    }

    renderPile(pile, pileName) {
        const pileElement = document.querySelector(`[data-pile="${pileName}"]`);
        if (!pileElement) return;

        pileElement.innerHTML = ''; // Clear previous cards
        const [pileType] = pileName.split('-');
        
        if (pileType === 'stock' && pile.length === 0) {
            pileElement.classList.add('empty');
        } else {
            pileElement.classList.remove('empty');
        }
        
        pile.forEach((cardData, i) => {
            const cardElement = this.createCardElement(cardData, pileName, i);
            pileElement.appendChild(cardElement);
        });
    }

    createCardElement(cardData, pileName, index) {
        const card = document.createElement('div');
        card.className = `card ${cardData.isFaceUp ? '' : 'is-flipped'}`;
        card.dataset.id = cardData.id;
        card.dataset.rank = cardData.rank;
        card.dataset.suit = cardData.suit;
        card.dataset.color = cardData.color;
        card.dataset.pile = pileName;
        card.style.setProperty('--card-index', index);

        const cardInner = document.createElement('div');
        cardInner.className = 'card-inner';

        const cardFront = document.createElement('div');
        cardFront.className = 'card-front';
        cardFront.innerHTML = `
            <div class="top-left">
                <div class="card-value">${cardData.rank}</div>
                <div class="card-suit"><img src="${this.suitSymbols[cardData.suit]}" alt="${cardData.suit}"></div>
            </div>
            <div class="bottom-right">
                <div class="card-value">${cardData.rank}</div>
                <div class="card-suit"><img src="${this.suitSymbols[cardData.suit]}" alt="${cardData.suit}"></div>
            </div>
        `;

        const cardBack = document.createElement('div');
        cardBack.className = 'card-back';

        cardInner.appendChild(cardFront);
        cardInner.appendChild(cardBack);
        card.appendChild(cardInner);

        return card;
    }
    
    showWinScreen() {
        document.getElementById('win-screen').classList.remove('hidden');
    }

    hideWinScreen() {
        document.getElementById('win-screen').classList.add('hidden');
    }
    
    animateWin(cards) {
        cards.forEach((card, i) => {
            setTimeout(() => {
                card.style.position = 'absolute'; // Ensure it can move freely
                card.style.zIndex = 3000 + i;
                
                const anim = card.animate([
                    { transform: 'translate(0, 0) rotate(0deg)', offset: 0 },
                    { transform: `translate(${Math.random() * 80 - 40}vw, ${Math.random() * 80 - 40}vh) rotate(${Math.random() * 720 - 360}deg)`, offset: 0.8 },
                    { transform: `translate(0, 150vh) rotate(${Math.random() * 720}deg)`, offset: 1 }
                ], {
                    duration: 2000 + Math.random() * 1000,
                    easing: 'ease-in-out',
                    delay: i * 50
                });
                anim.onfinish = () => { card.style.display = 'none'; };
            }, i * 50);
        });
    }
}