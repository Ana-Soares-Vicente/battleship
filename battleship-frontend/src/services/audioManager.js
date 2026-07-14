/**
 * AudioManager — Gerenciador centralizado de áudio do jogo.
 * Singleton: mantém uma única instância da música de fundo entre trocas de página.
 */

class AudioManager {
    constructor() {
        this.bgMusic = null;
        this.bgMusicInitialized = false;
        this.soundOn = this._loadSoundState();

        // Pré-carregar sons de efeito para evitar delay
        this._tntHitAudio = new Audio('/img/tnt-explodindo.mp3');
        this._tntHitAudio.preload = 'auto';
        this._tntHitAudio.volume = 0.8;

        this._tntExplosionAudio = new Audio('/img/tnt-explosao.mp3');
        this._tntExplosionAudio.preload = 'auto';
        this._tntExplosionAudio.volume = 0.8;

        this._splashAudio = new Audio('/img/splash-agua.mp3');
        this._splashAudio.preload = 'auto';
        this._splashAudio.volume = 0.6;
    }

    // ========================= //
    // ESTADO ON/OFF              //
    // ========================= //

    _loadSoundState() {
        const saved = localStorage.getItem('soundOn');
        return saved !== null ? saved === 'true' : true;
    }

    isSoundOn() {
        return this.soundOn;
    }

    setSoundOn(value) {
        this.soundOn = value;
        localStorage.setItem('soundOn', value.toString());
        if (this.bgMusic) {
            if (value) {
                this.bgMusic.volume = 0.5;
                if (this.bgMusic.paused) {
                    this.bgMusic.play().catch(() => {});
                }
            } else {
                this.bgMusic.volume = 0;
                this.bgMusic.pause();
            }
        }
    }

    // ========================= //
    // MÚSICA DE FUNDO           //
    // ========================= //

    initBackgroundMusic() {
        if (this.bgMusicInitialized) return;
        this.bgMusicInitialized = true;

        this.bgMusic = new Audio('/img/minecraft_lobby.mp3');
        this.bgMusic.loop = true;
        this.bgMusic.volume = 0;
        this.bgMusic.preload = 'auto';

        if (this.soundOn) {
            this.playBackgroundMusic();
        }
    }

    playBackgroundMusic() {
        if (!this.bgMusic || !this.soundOn) return;

        const playPromise = this.bgMusic.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this._fadeIn(this.bgMusic, 0.5, 1500);
            }).catch(() => {
                // Navegador bloqueou autoplay — tentar na próxima interação
                const handler = () => {
                    if (this.soundOn) {
                        this.bgMusic.play().then(() => {
                            this._fadeIn(this.bgMusic, 0.5, 1500);
                        }).catch(() => {});
                    }
                    document.removeEventListener('click', handler);
                    document.removeEventListener('keydown', handler);
                };
                document.addEventListener('click', handler);
                document.addEventListener('keydown', handler);
            });
        }
    }

    stopBackgroundMusic() {
        if (!this.bgMusic) return;
        this._fadeOut(this.bgMusic, 800, () => {
            this.bgMusic.pause();
        });
    }

    // ========================= //
    // EFEITOS SONOROS            //
    // ========================= //

    playExplosion() {
        if (!this.soundOn) return;
        const audio = new Audio('/img/explosao.mp3');
        audio.volume = 0.7;
        audio.play().catch((e) => {
            console.warn('Erro ao tocar explosão:', e);
        });
    }

    /** Água — tiro que não acertou nenhum navio */
    playSplash() {
        if (!this.soundOn) return;
        const audio = this._splashAudio.cloneNode();
        audio.volume = 0.6;
        audio.play().catch(() => {});
    }

    /** Acerto parcial — navio atingido mas ainda não afundou */
    playTntHit() {
        if (!this.soundOn) return;
        const audio = this._tntHitAudio.cloneNode();
        audio.volume = 0.8;
        audio.currentTime = 1.0;
        audio.play().catch(() => {});
    }

    /** Navio afundado — último pedaço destruído */
    playTntExplosion() {
        if (!this.soundOn) return;
        const audio = this._tntExplosionAudio.cloneNode();
        audio.volume = 0.8;
        audio.play().catch(() => {});
    }

    // ========================= //
    // FADE IN / FADE OUT         //
    // ========================= //

    _fadeIn(audio, targetVolume, duration) {
        const steps = 20;
        const stepTime = duration / steps;
        const increment = targetVolume / steps;
        let currentStep = 0;
        audio.volume = 0;

        const interval = setInterval(() => {
            currentStep++;
            audio.volume = Math.min(targetVolume, increment * currentStep);
            if (currentStep >= steps) {
                clearInterval(interval);
                audio.volume = targetVolume;
            }
        }, stepTime);
    }

    _fadeOut(audio, duration, onComplete) {
        const steps = 20;
        const stepTime = duration / steps;
        const startVolume = audio.volume;
        const decrement = startVolume / steps;
        let currentStep = 0;

        const interval = setInterval(() => {
            currentStep++;
            audio.volume = Math.max(0, startVolume - decrement * currentStep);
            if (currentStep >= steps) {
                clearInterval(interval);
                audio.volume = 0;
                if (onComplete) onComplete();
            }
        }, stepTime);
    }
}

// Singleton
const audioManager = new AudioManager();
export default audioManager;
