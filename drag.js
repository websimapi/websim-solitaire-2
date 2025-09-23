export class Drag {
    constructor(game, ui, sound) {
        this.game = game;
        this.ui = ui;
        this.sound = sound;
        this.draggedCards = [];
        this.draggedElements = [];
        this.offsetX = 0;
        this.offsetY = 0;
        this.startPile = null;
        this.isDragging = false;
        
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
    }

    addCardListeners() {
        const cards = document.querySelectorAll('.card');
        cards.forEach(card => {
            // Use pointerdown for dragging logic
            card.removeEventListener('pointerdown', this.onPointerDown);
            card.addEventListener('pointerdown', this.onPointerDown);
            
            // Use click/dblclick for tap actions
            card.onclick = (e) => this.onCardClick(e, card);
            card.ondblclick = (e) => this.onCardDblClick(e, card);
        });
    }

    onCardClick(e, cardElement) {
        e.stopPropagation(); // prevent game container click
        if (this.isDragging) return;

        const cardId = cardElement.dataset.id;
        const pileName = cardElement.dataset.pile;
        const [type, index] = pileName.split('-');

        if (type === 'stock') {
            this.game.dealFromStock();
            this.sound.play('deal');
            return;
        }

        if (cardElement.classList.contains('is-flipped')) {
            const pile = this.game.state.tableau[index];
            if (pile && pile.length > 0 && pile[pile.length - 1].id === cardId) {
                if (this.game.flipTableauCard(pile)) {
                    this.sound.play('deal');
                }
            }
        }
    }

    onCardDblClick(e, cardElement) {
        e.stopPropagation(); // prevent game container dblclick
        const cardId = cardElement.dataset.id;
        const targetFoundation = this.game.findAutoMoveTarget(cardId, 'foundation');
        if (targetFoundation) {
            if (this.game.moveCards([cardId], targetFoundation)) {
                this.sound.play('place');
            } else {
                this.sound.play('invalid');
            }
        } else {
            this.sound.play('invalid');
        }
    }

    onPointerDown(e) {
        if (e.button !== 0 || e.target.closest('.is-flipped')) return;

        const cardElement = e.target.closest('.card');
        if (!cardElement) return;

        this.isDragging = false; // Reset dragging state

        const cardId = cardElement.dataset.id;
        const { pile, pileName, cardIndex } = this.game.getCardAndPile(cardId);
        
        if (!pile || pile.length === 0) return;
        
        const [pileType] = pileName.split('-');
        
        // Allow dragging from tableau, waste, or foundations.
        // For waste and foundations, only the top card can be dragged.
        if (pileType === 'tableau' || ((pileType === 'waste' || pileType === 'foundation') && cardIndex === pile.length - 1)) {
            // This is a valid card to start dragging.
        } else {
            return; // Not a draggable card/pile
        }

        this.startPile = pileName;
        this.draggedCards = pile.slice(cardIndex);
        this.draggedElements = this.draggedCards.map(c => document.querySelector(`[data-id="${c.id}"]`));

        if (this.draggedElements.length === 0 || !this.draggedElements[0]) return;
        
        const rect = this.draggedElements[0].getBoundingClientRect();
        this.offsetX = e.clientX - rect.left;
        this.offsetY = e.clientY - rect.top;

        document.addEventListener('pointermove', this.onPointerMove);
        document.addEventListener('pointerup', this.onPointerUp, { once: true });
        document.addEventListener('pointercancel', this.onPointerUp, { once: true });
    }
    
    onPointerMove(e) {
        if (this.draggedElements.length === 0) return;
        e.preventDefault();

        if (!this.isDragging) {
             this.isDragging = true;
             this.prepareForDrag();
        }
       
        this.updateDraggedElementsPosition(e.clientX, e.clientY);
        this.updateDropZoneHighlight(e.clientX, e.clientY);
    }
    
    prepareForDrag() {
        if (this.draggedElements.length === 0) return;
        this.draggedElements.forEach((el, i) => {
            el.classList.add('dragging');
            el.style.zIndex = 1000 + i;
        });
    }

    updateDraggedElementsPosition(clientX, clientY) {
         if (this.draggedElements.length === 0) return;
         const visibleOverlap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tableau-overlap-visible'));
         const x = clientX - this.offsetX;
         const y = clientY - this.offsetY;
         this.draggedElements.forEach((el, i) => {
             const yOffset = i * visibleOverlap;
             el.style.transform = `translate(${x}px, ${y + yOffset}px)`;
         });
    }
    
    updateDropZoneHighlight(x, y) {
        document.querySelectorAll('.pile').forEach(p => p.classList.remove('drop-valid', 'drop-invalid'));
        
        // Temporarily hide cards to find element underneath
        this.draggedElements.forEach(el => el.style.pointerEvents = 'none');
        const dropTarget = document.elementFromPoint(x, y)?.closest('.pile');
        this.draggedElements.forEach(el => el.style.pointerEvents = 'auto');
        
        if (dropTarget) {
            const targetPileName = dropTarget.dataset.pile;
            const isValid = this.game.isValidMove(this.draggedCards[0], this.draggedCards.map(c => c.id), targetPileName);
            dropTarget.classList.add(isValid ? 'drop-valid' : 'drop-invalid');
        }
    }

    onPointerUp(e) {
        document.removeEventListener('pointermove', this.onPointerMove);
        
        if (this.isDragging) {
            document.querySelectorAll('.pile').forEach(p => p.classList.remove('drop-valid', 'drop-invalid'));
            
            if (this.draggedElements.length === 0) return;
    
            this.draggedElements.forEach(el => el.style.pointerEvents = 'none');
            const dropTarget = document.elementFromPoint(e.clientX, e.clientY)?.closest('.pile');
            this.draggedElements.forEach(el => el.style.pointerEvents = 'auto');
            
            let moveSuccessful = false;
            if (dropTarget) {
                const targetPileName = dropTarget.dataset.pile;
                moveSuccessful = this.game.moveCards(this.draggedCards.map(c => c.id), targetPileName);
            }
    
            if (moveSuccessful) {
                this.sound.play('place');
            } else {
                this.sound.play('invalid');
                // Re-render to snap back if move is invalid
                this.game.onStateChanged(this.game.state); 
            }
        }
        
        this.draggedElements.forEach(el => {
            el.classList.remove('dragging');
            el.style.zIndex = '';
            el.style.transform = '';
        });

        this.draggedCards = [];
        this.draggedElements = [];
        // Important: set isDragging to false at the end of the whole sequence.
        setTimeout(() => this.isDragging = false, 0);
    }
}