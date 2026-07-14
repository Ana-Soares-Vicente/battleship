import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import audioManager from '../../services/audioManager';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './Options.module.css';

export default function Options() {
    const username = localStorage.getItem('username');
    const navigate = useNavigate();
    const [soundOn, setSoundOn] = useState(audioManager.isSoundOn());
    const { t, language, setLanguage } = useTranslation();

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
                    {t('options.sounds')}: {soundOn ? t('options.on') : t('options.off')}
                </button>

                <button className={styles.btn} disabled>
                    {t('options.difficulty')}
                </button>

                <button className={styles.btn} onClick={() => setLanguage(language === 'pt-BR' ? 'en-US' : 'pt-BR')}>
                    {t('options.language').replace('...', '')}: {language === 'pt-BR' ? 'PORTUGUÊS' : 'ENGLISH'}
                </button>

                <div className={styles.btnRow}>
                    <button className={styles.btnHalf} onClick={() => navigate('/skins')}>
                        {t('skins.title').toUpperCase()}
                    </button>
                </div>

                <button className={styles.btn} onClick={() => navigate('/lobby')}>
                    {t('options.back')}
                </button>
            </div>

            {/* Skin do jogador no canto inferior esquerdo */}
            <div className={styles.playerCorner}>
                <img src={localStorage.getItem('skinAtual') || '/img/pactw_skin.webp'} alt={username} className={styles.playerSkin} />
                <div className={styles.playerInfo}>
                    <span className={styles.playerName}>{username || 'STEVE'}</span>
                    <span className={styles.playerRank}>{t('lobby.playerRank')}</span>
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
