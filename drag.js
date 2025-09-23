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
        this.startX = 0;
        this.startY = 0;
        this.lastTap = 0;
        
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
        this.onPointerCancel = this.onPointerCancel.bind(this);

        this.ui.gameContainer.addEventListener('pointerdown', this.onPointerDown);
    }

    makeCardsDraggable() {
        // All cards are potentially draggable via pointerdown on the container
    }

    onPointerDown(e) {
        // Ignore right clicks
        if (e.button !== 0) return;

        const targetElement = e.target;
        const cardElement = targetElement.closest('.card');

        this.isDragging = false;
        this.startX = e.clientX;
        this.startY = e.clientY;
        
        if (!cardElement || cardElement.closest('.card.is-flipped')) {
            this.handleContainerClick(targetElement.closest('.pile, #game-container'));
            return;
        }

        e.preventDefault();
        
        const cardId = cardElement.dataset.id;
        const { pile, pileName, cardIndex } = this.game.getCardAndPile(cardId);
        
        if (!pile) return;
        
        const [pileType] = pileName.split('-');
        if (pileType !== 'tableau' && pileType !== 'waste' && pileType !== 'foundation') return;

        this.startPile = pileName;
        this.draggedCards = pile.slice(cardIndex);
        this.draggedElements = this.draggedCards.map(c => document.querySelector(`[data-id="${c.id}"]`));

        if (this.draggedElements.length === 0 || !this.draggedElements[0]) return;
        
        const rect = this.draggedElements[0].getBoundingClientRect();
        this.offsetX = e.clientX - rect.left;
        this.offsetY = e.clientY - rect.top;

        document.addEventListener('pointermove', this.onPointerMove);
        document.addEventListener('pointerup', this.onPointerUp);
        document.addEventListener('pointercancel', this.onPointerCancel);
    }
    
    handleContainerClick(targetElement) {
        if (!targetElement) return;
        
        if (targetElement.matches('.pile')) {
            const pileName = targetElement.dataset.pile;
            if (!pileName) return;
    
            const [type] = pileName.split('-');
            if (type === 'stock') {
                this.game.dealFromStock();
                this.sound.play('deal');
            }
        } else if (targetElement.matches('#game-container, #tableau')) {
            // Double tap on background
            const now = Date.now();
            if (now - this.lastTap < 300) { // 300ms for double tap
                this.handleDoubleClick();
            }
            this.lastTap = now;
        }
    }
    
    handleCardTap(cardElement) {
        const cardId = cardElement.dataset.id;
        
        // Auto-move to foundation
        const targetFoundation = this.game.findAutoMoveTarget(cardId, 'foundation');
        if (targetFoundation) {
            if (this.game.moveCards([cardId], targetFoundation)) {
                this.sound.play('place');
            }
            return;
        }

        // Flip unflipped tableau card if it's the last in its pile
        const [type, index] = cardElement.dataset.pile.split('-');
        if (type === 'tableau') {
             const pile = this.game.state.tableau[index];
             if (pile.length > 0 && pile[pile.length - 1].id === cardId && !pile[pile.length - 1].isFaceUp) {
                 if(this.game.flipTableauCard(pile)) {
                     this.sound.play('deal');
                 }
             }
        }
    }

    handleDoubleClick() {
        console.log("Double click detected");
        if (this.game.autoPlayToFoundations()) {
            this.sound.play('place');
        }
    }

    onPointerMove(e) {
        if (this.draggedElements.length === 0) return;

        const dx = e.clientX - this.startX;
        const dy = e.clientY - this.startY;

        if (!this.isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
            this.isDragging = true;
            this.prepareForDrag();
        }
        
        if (this.isDragging) {
            e.preventDefault();
            this.updateDraggedElementsPosition(e.clientX, e.clientY);
            this.updateDropZoneHighlight(e.clientX, e.clientY);
        }
    }
    
    prepareForDrag() {
        const firstCardEl = this.draggedElements[0];
        if (!firstCardEl) return;
        const visibleOverlap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tableau-overlap-visible'));

        this.draggedElements.forEach((el, i) => {
            el.classList.add('dragging');
            el.style.zIndex = 1000 + i;
            const yOffset = i * visibleOverlap;
            const x = this.startX - this.offsetX;
            const y = this.startY - this.offsetY + yOffset;
            el.style.transform = `translate(${x}px, ${y}px)`;
        });
    }

    updateDraggedElementsPosition(clientX, clientY) {
         const visibleOverlap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tableau-overlap-visible'));
         this.draggedElements.forEach((el, i) => {
            const yOffset = i * visibleOverlap;
            const x = clientX - this.offsetX;
            const y = clientY - this.offsetY + yOffset;
            el.style.transform = `translate(${x}px, ${y}px)`;
        });
    }
    
    updateDropZoneHighlight(x, y) {
        document.querySelectorAll('.pile').forEach(p => p.classList.remove('drop-valid', 'drop-invalid'));
        const dropTarget = document.elementFromPoint(x, y)?.closest('.pile');
        if (dropTarget) {
            const targetPileName = dropTarget.dataset.pile;
            const isValid = this.game.isValidMove(this.draggedCards[0], this.draggedCards.map(c => c.id), targetPileName);
            dropTarget.classList.add(isValid ? 'drop-valid' : 'drop-invalid');
        }
    }

    onPointerUp(e) {
        document.removeEventListener('pointermove', this.onPointerMove);
        document.removeEventListener('pointerup', this.onPointerUp);
        document.removeEventListener('pointercancel', this.onPointerCancel);

        if (this.isDragging) {
            document.querySelectorAll('.pile').forEach(p => p.classList.remove('drop-valid', 'drop-invalid'));
            
            if (this.draggedElements.length === 0) return;
    
            // Temporarily hide dragged cards to find element underneath
            this.draggedElements.forEach(el => el.style.pointerEvents = 'none');
            const dropTarget = document.elementFromPoint(e.clientX, e.clientY)?.closest('.pile, .tableau-pile');
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
                this.game.onStateChanged(this.game.state); // Re-render to snap back
            }
        } else {
            // It's a tap
            const cardElement = e.target.closest('.card');
            if(cardElement) {
                this.handleCardTap(cardElement);
            }
        }
        
        this.draggedElements.forEach(el => {
            el.classList.remove('dragging');
            el.style.zIndex = '';
            el.style.transform = '';
        });

        this.draggedCards = [];
        this.draggedElements = [];
        this.isDragging = false;
    }

    onPointerCancel(e) {
        this.onPointerUp(e);
    }
}