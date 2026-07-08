import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { conectarWebSocket } from '../../services/websocket';
import styles from './Lobby.module.css';

export default function Lobby() {
    const navigate = useNavigate();
    const username = localStorage.getItem('username');

    useEffect(() => {
        conectarWebSocket(() => {});
    }, []);

    function handleLogout() {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('skinAtual');
        navigate('/', { replace: true });
    }

    return (
        <div className={styles.container}>
            {/* Título grande estilo MC */}
            <div className={styles.titleSection}>
                <h1 className={styles.title}>MINECRAFT</h1>
                <h2 className={styles.subtitle}>BATTLESHIP</h2>
                <span className={styles.tagline}>BETA!!</span>
            </div>

            {/* Botões centrais */}
            <div className={styles.menuButtons}>
                <button className={styles.btn} onClick={() => navigate('/criar-partida')}>
                    CREATE MATCH
                </button>
                <button className={styles.btn} onClick={() => navigate('/entrar-partida')}>
                    JOIN MATCH
                </button>

                <div className={styles.btnRow}>
                    <button className={styles.btnHalf} onClick={() => navigate('/options')}>
                        OPÇÕES...
                    </button>
                    <button className={styles.btnHalf} onClick={handleLogout}>
                        SAIR DO JOGO
                    </button>
                </div>
            </div>

            {/* Jogador no canto inferior esquerdo */}
            <div className={styles.playerCorner}>
                <img src={localStorage.getItem('skinAtual') || '/img/pactw_skin.webp'} alt={username} className={styles.playerSkin} />
                <div className={styles.playerInfo}>
                    <span className={styles.playerName}>{username || 'STEVE'}</span>
                    <span className={styles.playerRank}>Level 99 Admiral</span>
                </div>
            </div>

            {/* Versão no canto inferior direito */}
            <div className={styles.versionCorner}>
                <span>Minecraft Battleship v1.0.4-BETA</span>
                <span>© 2024 BLOCK NAVY INTEL</span>
            </div>
        </div>
    );
}
