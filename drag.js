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
        this.pointerDown = false;
        
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
        const cardElement = e.target.closest('.card');
        if (!cardElement || cardElement.classList.contains('is-flipped')) {
            this.handleContainerClick(e.target.closest('.pile'));
            return;
        }

        e.preventDefault();
        this.pointerDown = true;
        
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

        this.draggedElements.forEach((el, i) => {
            el.classList.add('dragging');
            el.style.zIndex = 1000 + i;
            const yOffset = i * (el.clientHeight / 4); // Tableau overlap
            el.style.transform = `translate(${e.clientX - rect.left - this.offsetX}px, ${e.clientY - rect.top - this.offsetY + yOffset}px)`;
        });

        document.addEventListener('pointermove', this.onPointerMove);
        document.addEventListener('pointerup', this.onPointerUp);
        document.addEventListener('pointercancel', this.onPointerCancel);
    }
    
    handleContainerClick(targetPileElement) {
        if (!targetPileElement) return;
        
        const pileName = targetPileElement.dataset.pile;
        if (!pileName) return;

        const [type] = pileName.split('-');
        if (type === 'stock') {
            this.game.dealFromStock();
            this.sound.play('deal');
        }
    }

    onPointerMove(e) {
        if (!this.pointerDown || this.draggedElements.length === 0) return;
        e.preventDefault();

        this.draggedElements.forEach((el, i) => {
            const rect = el.getBoundingClientRect();
            const yOffset = i * (el.clientHeight / 4); // Tableau overlap
            const x = e.clientX - this.offsetX;
            const y = e.clientY - this.offsetY + yOffset;
            el.style.transform = `translate(${x}px, ${y}px)`;
        });

        this.updateDropZoneHighlight(e.clientX, e.clientY);
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
        if (!this.pointerDown) return;
        this.pointerDown = false;
        
        document.removeEventListener('pointermove', this.onPointerMove);
        document.removeEventListener('pointerup', this.onPointerUp);
        document.removeEventListener('pointercancel', this.onPointerCancel);

        document.querySelectorAll('.pile').forEach(p => p.classList.remove('drop-valid', 'drop-invalid'));
        
        if (this.draggedElements.length === 0) return;

        const dropTarget = document.elementFromPoint(e.clientX, e.clientY)?.closest('.pile');
        
        let moveSuccessful = false;
        if (dropTarget) {
            const targetPileName = dropTarget.dataset.pile;
            moveSuccessful = this.game.moveCards(this.draggedCards.map(c => c.id), targetPileName);
        }

        if (moveSuccessful) {
            this.sound.play('place');
        } else {
            // Animate back if move is invalid
            this.sound.play('invalid');
            this.game.onStateChanged(this.game.state); // Re-render to snap back
        }
        
        this.draggedElements.forEach(el => {
            el.classList.remove('dragging');
            el.style.zIndex = '';
            el.style.transform = '';
        });

        this.draggedCards = [];
        this.draggedElements = [];
    }

    onPointerCancel(e) {
        this.onPointerUp(e);
    }
}

