class SakuraPetal {
    constructor(canvasWidth, canvasHeight, scale) {
        this.w = canvasWidth;
        this.h = canvasHeight;
        this.scale = scale;
        this.reset(true);
    }

    reset(initial = false) {
        // ZONA DE NASCIMENTO: Agora preenche 100% do eixo X (largura) na parte inferior
        if (initial) {
            this.x = Math.random() * this.w;
            this.y = Math.random() * this.h;
        } else {
            this.x = Math.random() * this.w;
            this.y = this.h + (Math.random() * 100) * this.scale;
        }

        // VETOR DE MOVIMENTO: Subindo e derivando para a esquerda ou direita de forma caótica
        this.vx = (Math.random() * 2 - 1) * this.scale; 
        this.vy = (Math.random() * -2.5 - 1.0) * this.scale; 

        // ROTAÇÃO E ESCALA BASE
        this.size = (Math.random() * 0.6 + 0.4) * this.scale;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() * 0.04 - 0.02);
        
        // EFEITO 3D (TUMBLING): O segredo para parecer uma folha real caindo/subindo
        this.flip = Math.random() * Math.PI * 2;
        this.flipSpeed = Math.random() * 0.04 + 0.01;

        // EFEITO DE VENTO: Movimento em "S" orgânico
        this.sway = Math.random() * Math.PI * 2;
        this.swaySpeed = Math.random() * 0.02 + 0.01;
        this.swayAmount = (Math.random() * 1.5 + 0.5) * this.scale;
    }

    update() {
        // Aplica a física
        this.x += this.vx + Math.sin(this.sway) * this.swayAmount;
        this.y += this.vy;
        
        // Incrementa os contadores de animação orgânica
        this.sway += this.swaySpeed;
        this.rotation += this.rotationSpeed;
        this.flip += this.flipSpeed;

        // Se sair pelo topo ou sumir pelas laterais, mata a pétala e renasce embaixo
        if (this.y < -100 * this.scale || this.x < -100 * this.scale || this.x > this.w + 100 * this.scale) {
            this.reset(false);
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // A MÁGICA 3D: Achatar e inverter o eixo Y usando o Cosseno do flip.
        // Como o Math.cos vai de 1 a -1, a folha encolhe, some e desenha invertida.
        ctx.scale(this.size, this.size * Math.cos(this.flip));

        // Desenho vetorial curvado da pétala
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-15, -15, -15, -35, 0, -45); 
        ctx.bezierCurveTo(15, -35, 15, -15, 0, 0); 
        ctx.closePath();
        
        // Degradê da pétala (Mais forte na base, mais claro na ponta)
        const grad = ctx.createLinearGradient(0, 0, 0, -45);
        grad.addColorStop(0, "rgba(255, 183, 197, 0.95)"); 
        grad.addColorStop(1, "rgba(255, 105, 135, 0.6)"); 
        
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
