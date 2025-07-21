// client/features/canvas.js
export class CanvasManager {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.currentTool = 'pen';
        this.currentColor = '#ffffff';
        this.currentSize = 2;
        
        this.initializeCanvas();
    }

    initializeCanvas() {
        // This would be used for collaborative drawing/whiteboard features
        // Currently just a placeholder for future implementation
        console.log('Canvas manager initialized');
    }

    createCanvas(container) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 800;
        this.canvas.height = 600;
        this.canvas.style.border = '1px solid #ccc';
        this.canvas.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        
        this.ctx = this.canvas.getContext('2d');
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        container.appendChild(this.canvas);
        
        this.bindCanvasEvents();
    }

    bindCanvasEvents() {
        if (!this.canvas) return;

        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

        // Touch events for mobile
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const mouseEvent = new MouseEvent('mouseup', {});
            this.canvas.dispatchEvent(mouseEvent);
        });
    }

    startDrawing(e) {
        this.isDrawing = true;
        const rect = this.canvas.getBoundingClientRect();
        this.lastX = e.clientX - rect.left;
        this.lastY = e.clientY - rect.top;
    }

    draw(e) {
        if (!this.isDrawing) return;

        const rect = this.canvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        this.ctx.globalCompositeOperation = this.currentTool === 'eraser' ? 'destination-out' : 'source-over';
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.currentSize;

        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(currentX, currentY);
        this.ctx.stroke();

        this.lastX = currentX;
        this.lastY = currentY;

        // In a real app, you'd send drawing data to other users
        this.broadcastDrawing({
            type: 'draw',
            fromX: this.lastX,
            fromY: this.lastY,
            toX: currentX,
            toY: currentY,
            color: this.currentColor,
            size: this.currentSize,
            tool: this.currentTool
        });
    }

    stopDrawing() {
        this.isDrawing = false;
    }

    setTool(tool) {
        this.currentTool = tool;
    }

    setColor(color) {
        this.currentColor = color;
    }

    setSize(size) {
        this.currentSize = size;
    }

    clearCanvas() {
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.broadcastDrawing({ type: 'clear' });
        }
    }

    broadcastDrawing(data) {
        // In a real app, this would send drawing data through WebSocket
        console.log('Broadcasting drawing data:', data);
    }

    handleRemoteDrawing(data) {
        if (!this.ctx) return;

        switch (data.type) {
            case 'draw':
                this.ctx.globalCompositeOperation = data.tool === 'eraser' ? 'destination-out' : 'source-over';
                this.ctx.strokeStyle = data.color;
                this.ctx.lineWidth = data.size;
                this.ctx.beginPath();
                this.ctx.moveTo(data.fromX, data.fromY);
                this.ctx.lineTo(data.toX, data.toY);
                this.ctx.stroke();
                break;
            case 'clear':
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                break;
        }
    }
}