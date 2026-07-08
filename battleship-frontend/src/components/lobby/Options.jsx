import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import audioManager from '../../services/audioManager';
import styles from './Options.module.css';

export default function Options() {
    const username = localStorage.getItem('username');
    const navigate = useNavigate();
    const [soundOn, setSoundOn] = useState(audioManager.isSoundOn());

    function handleToggleSound() {
        const newState = !soundOn;
        setSoundOn(newState);
        audioManager.setSoundOn(newState);
    }

    return (
        <div className={styles.container}>
            {/* Título */}
            <div className={styles.titleSection}>
                <h1 className={styles.title}>MINECRAFT</h1>
                <h2 className={styles.subtitle}>BATTLESHIP</h2>
                <span className={styles.tagline}>BETA!!</span>
            </div>

            {/* Painel de opções */}
            <div className={styles.menuButtons}>
                <button className={styles.btn} onClick={handleToggleSound}>
                    SONS: {soundOn ? 'ON' : 'OFF'}
                </button>

                <button className={styles.btn} disabled>
                    DIFICULDADE: NORMAL
                </button>

                <div className={styles.btnRow}>
                    <button className={styles.btnHalf} onClick={() => navigate('/skins')}>
                        SKIN...
                    </button>
                    <button className={styles.btnHalf} disabled>
                        IDIOMA...
                    </button>
                </div>

                <button className={styles.btn} onClick={() => navigate('/lobby')}>
                    VOLTAR
                </button>
            </div>

            {/* Skin do jogador no canto inferior esquerdo */}
            <div className={styles.playerCorner}>
                <img src={localStorage.getItem('skinAtual') || '/img/pactw_skin.webp'} alt={username} className={styles.playerSkin} />
                <div className={styles.playerInfo}>
                    <span className={styles.playerName}>{username || 'STEVE'}</span>
                    <span className={styles.playerRank}>Level 99 Admiral</span>
                </div>
            </div>

            {/* Versão */}
            <div className={styles.versionCorner}>
                <span>Minecraft Battleship v1.0.4-BETA</span>
                <span>© 2024 BLOCK NAVY INTEL</span>
            </div>
        </div>
    );
}
