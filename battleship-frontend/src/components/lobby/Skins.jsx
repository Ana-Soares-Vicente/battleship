import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateSkin } from '../../services/api';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './Skins.module.css';

const SKINS_DISPONIVEIS = [
    { id: 'authentic', nome: 'Authentic', img: '/img/authentic_skin.png' },
    { id: 'jvnq', nome: 'JVNQ', img: '/img/jvnq_skin.png' },
    { id: 'venom', nome: 'Venom', img: '/img/venom_skin.png' },
    { id: 'mike', nome: 'Mike', img: '/img/mike_skin.png' },
    { id: 'moonkase', nome: 'Moonkase', img: '/img/moonkase_skin.png' },
    { id: 'pactw', nome: 'PacTw', img: '/img/pactw_skin.webp' },
    { id: 'rezende', nome: 'Rezende', img: '/img/rezende_skin.png' },
];

function getSkinAtual() {
    return localStorage.getItem('skinAtual') || '/img/pactw_skin.webp';
}

export default function Skins() {
    const username = localStorage.getItem('username');
    const navigate = useNavigate();
    const [skinAtual, setSkinAtual] = useState(getSkinAtual());
    const { t } = useTranslation();

    function handleTrocarSkin(novaSkin) {
        localStorage.setItem('skinAtual', novaSkin.img);
        setSkinAtual(novaSkin.img);
        updateSkin(novaSkin.img).catch(() => {});
    }

    // Skins disponíveis = todas menos a atual
    const skinsParaEscolher = SKINS_DISPONIVEIS.filter(s => s.img !== skinAtual);

    return (
        <div className={styles.container}>
            <div className={styles.inventoryWindow}>
                <div className={styles.windowTitle}>{t('skins.title')}</div>

                {/* Área superior: skin atual */}
                <div className={styles.topArea}>
                    <div className={styles.armorSlots}>
                        <div className={styles.slotArmor}><span className={styles.armorIcon}>⛑</span></div>
                        <div className={styles.slotArmor}><span className={styles.armorIcon}>👕</span></div>
                        <div className={styles.slotArmor}><span className={styles.armorIcon}>👖</span></div>
                        <div className={styles.slotArmor}><span className={styles.armorIcon}>👢</span></div>
                    </div>

                    <div className={styles.skinDisplay}>
                        <img
                            src={skinAtual}
                            alt={username}
                            className={styles.skinImg}
                            draggable={false}
                        />
                    </div>

                    <div className={styles.playerInfo}>
                        <span className={styles.playerName}>{username || 'STEVE'}</span>
                        <span className={styles.playerRank}>Level 99 Admiral</span>
                        <span className={styles.skinAtualLabel}>{t('skins.equipped')}</span>
                    </div>
                </div>

                {/* Skins disponíveis para trocar */}
                <div className={styles.skinsLabel}>{t('skins.available')}</div>
                <div className={styles.skinsGrid}>
                    {skinsParaEscolher.map((skin) => (
                        <div
                            key={skin.id}
                            className={styles.skinSlot}
                            onClick={() => handleTrocarSkin(skin)}
                            title={`Equipar ${skin.nome}`}
                        >
                            <img
                                src={skin.img}
                                alt={skin.nome}
                                className={styles.skinThumb}
                                draggable={false}
                            />
                            <span className={styles.skinName}>{skin.nome}</span>
                        </div>
                    ))}
                </div>

                {/* Botão voltar */}
                <button className={styles.btnVoltar} onClick={() => navigate('/options')}>
                    {t('skins.back')}
                </button>
            </div>
        </div>
    );
}
