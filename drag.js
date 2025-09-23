export class Drag {
    constructor(game, ui, sound) {
        this.game = game;
        this.ui = ui;
        this.sound = sound;
        this.draggedCards = [];
        this.draggedElements = [];
        this.offsetX = 0;
        this.offsetY = 0;
        this.startX = 0; // To track starting pointer position
        this.startY = 0;
        this.startPile = null;
        this.isDragging = false;
        
        // New properties for correct positioning
        this.startPositions = []; // To store original positions of dragged cards
        
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
        // Prevent scrolling on the game container, which can interfere with dragging
        document.getElementById('game-container').addEventListener('touchmove', e => e.preventDefault(), { passive: false });
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
        const { card } = this.game.getCardAndPile(cardId);
        const tableauTargets = Array.from({ length: 7 }, (_, i) => `tableau-${i}`)
            .filter(name => this.game.isValidMove(card, [cardId], name));
        let chosen = null;
        if (tableauTargets.length) {
            const cx = cardElement.getBoundingClientRect();
            const ccx = cx.left + cx.width / 2, ccy = cx.top + cx.height / 2;
            chosen = tableauTargets.reduce((best, name) => {
                const el = document.querySelector(`[data-pile="${name}"]`);
                const r = el.getBoundingClientRect();
                const px = r.left + r.width / 2, py = r.top + r.height / 2;
                const d = Math.hypot(px - ccx, py - ccy);
                return !best || d < best.d ? { name, d } : best;
            }, null)?.name;
        }
        const target = chosen || this.game.findAutoMoveTarget(cardId, 'foundation');
        if (target && this.game.moveCards([cardId], target)) {
            this.sound.play('place');
        } else {
            this.sound.play('invalid');
        }
    }

    onPointerDown(e) {
        if (e.button !== 0 || e.target.closest('.is-flipped')) return;

        const cardElement = e.target.closest('.card');
        if (!cardElement) return;

        // A pointerdown might be a click or the start of a drag.
        // We'll only set isDragging to true after a certain movement threshold.
        this.isDragging = false;

        const cardId = cardElement.dataset.id;
        const { pile, pileName, cardIndex } = this.game.getCardAndPile(cardId);
        
        if (!pile || pile.length === 0) return;
        
        const [pileType] = pileName.split('-');
        
        // Allow dragging from tableau stacks.
        if (pileType === 'tableau') {
            // Must be face up and form a valid sequence
            const cardsToMove = pile.slice(cardIndex);
            if (cardsToMove.length === 0 || !cardsToMove[0].isFaceUp || !this.game.isValidTableauSequence(cardsToMove)) {
                return;
            }
        } 
        // Allow dragging top card from waste or foundations.
        else if ((pileType === 'waste' || pileType === 'foundation') && cardIndex === pile.length - 1) {
            // Draggable.
        } else {
            return; // Not a draggable card/pile
        }

        this.startPile = pileName;
        this.draggedCards = pile.slice(cardIndex);
        this.draggedElements = this.draggedCards.map(c => document.querySelector(`[data-id="${c.id}"]`));

        if (this.draggedElements.length === 0 || !this.draggedElements[0]) return;
        
        // Prevent default actions like text selection
        e.preventDefault();
        
        const rect = this.draggedElements[0].getBoundingClientRect();
        this.offsetX = e.clientX - rect.left;
        this.offsetY = e.clientY - rect.top;
        this.startX = e.clientX;
        this.startY = e.clientY;

        // Store initial positions
        this.startPositions = this.draggedElements.map(el => {
            const elRect = el.getBoundingClientRect();
            return { x: elRect.left, y: elRect.top };
        });

        document.addEventListener('pointermove', this.onPointerMove);
        document.addEventListener('pointerup', this.onPointerUp, { once: true });
        document.addEventListener('pointercancel', this.onPointerUp, { once: true });
    }
    
    onPointerMove(e) {
        if (this.draggedElements.length === 0) return;
        e.preventDefault();

        if (!this.isDragging) {
            const dx = e.clientX - this.startX;
            const dy = e.clientY - this.startY;
            // Only start dragging if the pointer has moved a certain distance
            if (Math.sqrt(dx * dx + dy * dy) > 5) {
                this.isDragging = true;
                this.prepareForDrag();
            }
        }
       
        if (this.isDragging) {
            this.updateDraggedElementsPosition(e.clientX, e.clientY);
            this.updateDropZoneHighlight(e.clientX, e.clientY);
        }
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
         
         const deltaX = clientX - this.startX;
         const deltaY = clientY - this.startY;

         this.draggedElements.forEach((el, i) => {
            // No need to use startPos, as transform is relative to the element's layout position.
            el.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
         });
    }
    
    updateDropZoneHighlight(x, y) {
        document.querySelectorAll('.pile').forEach(p => p.classList.remove('drop-valid', 'drop-invalid'));
        
        // Temporarily hide cards to find element underneath
        const visibility = this.draggedElements.map(el => el.style.visibility);
        this.draggedElements.forEach(el => el.style.visibility = 'hidden');
        
        const dropTarget = document.elementFromPoint(x, y)?.closest('.pile');
        
        // Restore elements
        this.draggedElements.forEach((el, i) => el.style.visibility = visibility[i] || '');
        
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
            
            if (this.draggedElements.length === 0) {
                this.resetDragState();
                return;
            }
    
            // Temporarily hide cards to find element underneath
            const visibility = this.draggedElements.map(el => el.style.visibility);
            this.draggedElements.forEach(el => el.style.visibility = 'hidden');
            
            const dropTarget = document.elementFromPoint(e.clientX, e.clientY)?.closest('.pile');
            
            // Restore elements before state change
            this.draggedElements.forEach((el, i) => el.style.visibility = visibility[i] || '');
            
            let moveSuccessful = false;
            if (dropTarget) {
                const targetPileName = dropTarget.dataset.pile;
                moveSuccessful = this.game.moveCards(this.draggedCards.map(c => c.id), targetPileName);
            }
    
            if (moveSuccessful) {
                this.sound.play('place');
            } else {
                this.sound.play('invalid');
                // The reset will handle snapping back, no need for extra code here
            }
        }
        
        this.resetDragState();
    }

    resetDragState() {
        if (this.draggedElements) {
            this.draggedElements.forEach(el => {
                if (el) {
                    el.classList.remove('dragging');
                    el.style.zIndex = '';
                    el.style.transform = '';
                }
            });
        }

        this.draggedCards = [];
        this.draggedElements = [];
        this.startPile = null;
        this.startPositions = []; // Clear stored positions
        
        // Important: set isDragging to false at the end of the whole sequence.
        // This setTimeout ensures that any 'click' event that fires after 'pointerup'
        // can be correctly ignored because isDragging will still be true.
        setTimeout(() => this.isDragging = false, 0);
    }
}