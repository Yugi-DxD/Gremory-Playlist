class SakuraPetal {
    constructor(canvasWidth, canvasHeight, scale) {
        this.w = canvasWidth;
        this.h = canvasHeight;
        this.scale = scale;
        this.reset(true);
    }

    reset(initial = false) {
        // Inicializa as partículas distribuídas pela tela na primeira vez
        // Depois, as pétalas mortas nascem apenas do canto inferior esquerdo
        if (initial) {
            this.x = Math.random() * this.w;
            this.y = Math.random() * this.h;
        } else {
            // Zona de nascimento: Canto inferior esquerdo (X negativo/baixo, Y alto/fora da tela)
            this.x = (Math.random() * 400 - 200) * this.scale;
            this.y = this.h + (Math.random() * 200) * this.scale;
        }

        // Vetor de movimento (Para a direita e para cima)
        this.vx = (Math.random() * 2.5 + 1.0) * this.scale; 
        this.vy = (Math.random() * -2.5 - 1.0) * this.scale; 

        // Rotação 3D orgânica e Tamanho
        this.size = (Math.random() * 0.7 + 0.4) * this.scale;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() * 0.04 - 0.02);
        
        // Efeito de vento (Senoide)
        this.sway = Math.random() * Math.PI * 2;
        this.swaySpeed = Math.random() * 0.02 + 0.01;
        this.swayAmount = (Math.random() * 1.5 + 0.5) * this.scale;
    }

    update() {
        // Aplica o vento sinuoso no eixo X
        this.x += this.vx + Math.sin(this.sway) * this.swayAmount;
        this.y += this.vy;
        this.sway += this.swaySpeed;
        this.rotation += this.rotationSpeed;

        // Se sair pela direita ou pelo topo, mata a pétala e renasce
        if (this.x > this.w + 100 * this.scale || this.y < -100 * this.scale) {
            this.reset(false);
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(this.size, this.size);

        // Desenho vetorial curvado da pétala
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-15, -15, -15, -35, 0, -45); 
        ctx.bezierCurveTo(15, -35, 15, -15, 0, 0); 
        ctx.closePath();
        
        // Degradê da pétala (Rosa Escuro para Rosa Claro)
        const grad = ctx.createLinearGradient(0, 0, 0, -45);
        grad.addColorStop(0, "rgba(255, 183, 197, 0.9)"); 
        grad.addColorStop(1, "rgba(255, 105, 135, 0.5)"); 
        
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
    }
}

class SakuraEngine {
    constructor(canvasId, config) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d', { alpha: true, desynchronized: true });
        this.config = config;
        this.particles = [];
        this.rAF = null;
        this.isReady = false;
        
        this.renderLoop = this.renderLoop.bind(this);
        this.handleVisibility = this.handleVisibility.bind(this);
    }

    init() {
        this.resize();
        for (let i = 0; i < this.config.particleCount; i++) {
            this.particles.push(new SakuraPetal(this.width, this.height, this.scale));
        }
        this.isReady = true;
        document.addEventListener('visibilitychange', this.handleVisibility);
        this.rAF = requestAnimationFrame(this.renderLoop);
    }

    handleVisibility() {
        if (document.visibilityState === 'visible') {
            if (!this.rAF) this.rAF = requestAnimationFrame(this.renderLoop);
        } else {
            if (this.rAF) { cancelAnimationFrame(this.rAF); this.rAF = null; }
        }
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        // Escalonador dinâmico: Pétalas terão o mesmo tamanho físico seja em 1080p ou 4K
        const isH = this.width > this.height;
        const baseW = isH ? 3840 : 2160;
        const baseH = isH ? 2160 : 3840;
        this.scale = Math.min(this.width / baseW, this.height / baseH);

        this.particles.forEach(p => {
            p.w = this.width;
            p.h = this.height;
            p.scale = this.scale;
        });
    }

    renderLoop() {
        if (!this.isReady) return;
        
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        const len = this.particles.length;
        for (let i = 0; i < len; i++) {
            this.particles[i].update();
            this.particles[i].draw(this.ctx);
        }
        
        this.rAF = requestAnimationFrame(this.renderLoop);
    }
}
