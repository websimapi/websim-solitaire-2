export class Drag {
    constructor(game, ui, sound) {
        this.game = game;
        this.ui = ui;
        this.sound = sound;
        this.draggedCards = [];
        this.draggedElements = [];
        this.offsetX = 0;
        this.offsetY = 0;
        this.startX = 0;
        this.startY = 0;
        this.startPile = null;
        this.isDragging = false;
        this.dragStarted = false; // Track if drag actually started
        this.pointerId = null;
        this.captureEl = null;

        // Store original positions for snap back
        this.originalPositions = [];

        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);

        // Add global listeners for move and up events
        document.addEventListener('pointermove', this.onPointerMove, { passive: false });
        document.addEventListener('pointerup', this.onPointerUp);
        document.addEventListener('pointercancel', this.onPointerUp);
    }

    addCardListeners() {
        const cards = document.querySelectorAll('.card');
        cards.forEach(card => {
            card.removeEventListener('pointerdown', this.onPointerDown);
            card.addEventListener('pointerdown', this.onPointerDown, { passive: false });

            // Click handlers for non-drag interactions
            card.onclick = (e) => {
                if (!this.dragStarted) {
                    this.onCardClick(e, card);
                }
            };
            card.ondblclick = (e) => {
                if (!this.dragStarted) {
                    this.onCardDblClick(e, card);
                }
            };
        });

        // Prevent scrolling on the game container
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
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        const cardElement = e.target.closest('.card');
        if (!cardElement) return;

        e.preventDefault();
        e.stopPropagation();

        const cardId = cardElement.dataset.id;
        const { pile, pileName, cardIndex } = this.game.getCardAndPile(cardId);

        if (!pile || pile.length === 0) return;

        const [pileType] = pileName.split('-');

        // Validate draggable cards
        if (pileType === 'tableau') {
            const cardsToMove = pile.slice(cardIndex);
            if (cardsToMove.length === 0 || !cardsToMove[0].isFaceUp || !this.game.isValidTableauSequence(cardsToMove)) {
                return;
            }
        } else if ((pileType === 'waste' || pileType === 'foundation') && cardIndex === pile.length - 1) {
            // Allow dragging top card
        } else {
            return;
        }

        // Reset drag state
        this.isDragging = false;
        this.dragStarted = false;

        this.startPile = pileName;
        this.draggedCards = pile.slice(cardIndex);
        this.draggedElements = this.draggedCards.map(c => document.querySelector(`[data-id="${c.id}"]`));

        if (this.draggedElements.length === 0 || !this.draggedElements[0]) return;

        const rect = this.draggedElements[0].getBoundingClientRect();
        this.offsetX = e.clientX - rect.left;
        this.offsetY = e.clientY - rect.top;
        this.startX = e.clientX;
        this.startY = e.clientY;

        // Store original positions for snap back
        this.originalPositions = this.draggedElements.map(el => {
            const elRect = el.getBoundingClientRect();
            const containerRect = document.getElementById('game-container').getBoundingClientRect();
            return {
                x: elRect.left - containerRect.left,
                y: elRect.top - containerRect.top
            };
        });

        this.pointerId = e.pointerId;
        this.captureEl = e.currentTarget;
        try { this.captureEl.setPointerCapture(this.pointerId); } catch {}
    }

    onPointerMove(e) {
        if (this.draggedElements.length === 0) return;

        const dx = e.clientX - this.startX;
        const dy = e.clientY - this.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Start dragging after moving a threshold distance
        if (!this.isDragging && distance > 8) {
            this.isDragging = true;
            this.dragStarted = true;
            this.prepareForDrag();
        }

        if (this.isDragging) {
            e.preventDefault();
            this.updateDraggedElementsPosition(e.clientX, e.clientY);
            this.updateDropZoneHighlight(e.clientX, e.clientY);
        }
    }

    prepareForDrag() {
        this.draggedElements.forEach((el, i) => {
            el.classList.add('dragging');
            el.style.position = 'fixed';
            el.style.zIndex = 1000 + i;
            el.style.pointerEvents = 'none'; // Prevent interference with drop detection
        });
    }

    updateDraggedElementsPosition(clientX, clientY) {
        if (this.draggedElements.length === 0) return;

        const baseX = clientX - this.offsetX;
        const baseY = clientY - this.offsetY;

        this.draggedElements.forEach((el, i) => {
            const yOffset = i * 25; // Stack cards with slight vertical offset
            el.style.left = `${baseX}px`;
            el.style.top = `${baseY + yOffset}px`;
        });
    }

    updateDropZoneHighlight(x, y) {
        // Clear previous highlights
        document.querySelectorAll('.pile').forEach(p => p.classList.remove('drop-valid', 'drop-invalid'));

        // Find drop target
        const dropTarget = document.elementFromPoint(x, y)?.closest('.pile');

        if (dropTarget && this.draggedCards.length > 0) {
            const targetPileName = dropTarget.dataset.pile;
            const isValid = this.game.isValidMove(this.draggedCards[0], this.draggedCards.map(c => c.id), targetPileName);
            dropTarget.classList.add(isValid ? 'drop-valid' : 'drop-invalid');
        }
    }

    onPointerUp(e) {
        if (!this.isDragging || this.draggedElements.length === 0) {
            this.resetDragState();
            return;
        }

        // Clear highlights
        document.querySelectorAll('.pile').forEach(p => p.classList.remove('drop-valid', 'drop-invalid'));

        // Find drop target
        const dropTarget = document.elementFromPoint(e.clientX, e.clientY)?.closest('.pile');

        let moveSuccessful = false;
        if (dropTarget) {
            const targetPileName = dropTarget.dataset.pile;
            moveSuccessful = this.game.moveCards(this.draggedCards.map(c => c.id), targetPileName);
        }

        if (moveSuccessful) {
            this.sound.play('place');
        } else {
            this.sound.play('invalid');
            this.snapBack();
        }

        this.resetDragState();
    }

    snapBack() {
        // Animate cards back to original positions
        this.draggedElements.forEach((el, i) => {
            if (el && this.originalPositions[i]) {
                const original = this.originalPositions[i];
                const containerRect = document.getElementById('game-container').getBoundingClientRect();
                
                el.style.transition = 'left 0.3s ease-out, top 0.3s ease-out';
                el.style.left = `${containerRect.left + original.x}px`;
                el.style.top = `${containerRect.top + original.y}px`;
                
                setTimeout(() => {
                    if (el) {
                        el.style.transition = '';
                    }
                }, 300);
            }
        });
    }

    resetDragState() {
        if (this.draggedElements) {
            this.draggedElements.forEach(el => {
                if (el) {
                    el.classList.remove('dragging');
                    el.style.position = '';
                    el.style.left = '';
                    el.style.top = '';
                    el.style.zIndex = '';
                    el.style.pointerEvents = '';
                    el.style.transition = '';
                }
            });
        }

        this.draggedCards = [];
        this.draggedElements = [];
        this.startPile = null;
        this.originalPositions = [];

        this.pointerId = null;
        this.captureEl = null;

        // Reset drag flags after a short delay to prevent click events from firing
        setTimeout(() => {
            this.isDragging = false;
            this.dragStarted = false;
        }, 50);
    }
}