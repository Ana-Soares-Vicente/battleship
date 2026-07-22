import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import audioManager from '../../services/audioManager';
import styles from './GameOverScreen.module.css';

/**
 * Tela de fim de partida — estilo clássico de morte do Minecraft.
 * - Overlay vermelho (derrota) ou verde (vitória) cobrindo 100% da viewport
 * - Vídeo do modo atual ao fundo, visível por trás do overlay
 * - Apenas UM texto conforme idioma selecionado
 * - Pontuação = quantidade de navios afundados
 * - Som de vitória (minecraft-exp) ou derrota (blaze-morrendo) ao exibir
 * - Mensagem de inatividade/abandono quando aplicável
 * - Botão de Revanche com indicador de skin do solicitante
 */
export default function GameOverScreen({ venceu, pontuacao, modo, onVoltar, motivo, adversario, onRevanche, revancheSolicitante, skinSolicitante }) {
    const { t } = useTranslation();
    const [fase, setFase] = useState(0);
    const somTocadoRef = useRef(false);

    useEffect(() => {
        const timers = [
            setTimeout(() => setFase(1), 100),   // overlay
            setTimeout(() => setFase(2), 500),   // título
            setTimeout(() => setFase(3), 900),   // subtítulo/pontuação
            setTimeout(() => setFase(4), 1300),  // botão
        ];
        return () => timers.forEach(clearTimeout);
    }, []);

    // Tocar som apenas uma vez ao montar o componente
    useEffect(() => {
        if (somTocadoRef.current) return;
        somTocadoRef.current = true;

        if (venceu) {
            audioManager.playVictory();
        } else {
            audioManager.playDefeat();
        }
    }, [venceu]);

    const videoSrc = modo === 'EXPLOSAO'
        ? '/img/fundos/nether_video_modoexplosao.mp4'
        : '/img/fundos/fundo_padrao_peixes_mexendo.mp4';

    // Mensagem de motivo (inatividade/abandono)
    const getMotivoTexto = () => {
        if (!motivo) return null;
        if (motivo === 'inatividade') {
            if (venceu) {
                return `${adversario || '???'} ${t('gameEnd.lostByInactivity')}`;
            } else {
                return t('gameEnd.youLostByInactivity');
            }
        }
        if (motivo === 'abandono') {
            if (venceu) {
                return `${adversario || '???'} ${t('gameEnd.lostByForfeit')}`;
            } else {
                return t('gameEnd.youLostByForfeit');
            }
        }
        return null;
    };

    const motivoTexto = getMotivoTexto();

    return (
        <div className={styles.fullscreen}>
            {/* Vídeo de fundo do modo atual */}
            <video
                className={styles.bgVideo}
                src={videoSrc}
                autoPlay
                loop
                muted
                playsInline
                ref={el => { if (el && modo === 'EXPLOSAO') el.playbackRate = 0.6; }}
            />

            {/* Overlay colorido — cobre 100% da viewport */}
            <div
                className={`${styles.overlay} ${venceu ? styles.overlayVitoria : styles.overlayDerrota} ${fase >= 1 ? styles.overlayVisible : ''}`}
            />

            {/* Conteúdo centralizado — igual ao Minecraft */}
            <div className={styles.content}>
                <h1 className={`${styles.titulo} ${venceu ? styles.tituloVitoria : styles.tituloDerrota} ${fase >= 2 ? styles.visible : ''}`}>
                    {venceu ? t('gameEnd.youWin') : t('gameEnd.gameOver')}
                </h1>

                {motivoTexto && (
                    <p className={`${styles.motivo} ${fase >= 3 ? styles.visible : ''}`}>
                        {motivoTexto}
                    </p>
                )}

                <p className={`${styles.pontuacao} ${fase >= 3 ? styles.visible : ''}`}>
                    {t('gameEnd.score')}: {pontuacao}
                </p>

                <button
                    className={`${styles.btnVoltar} ${fase >= 4 ? styles.visible : ''}`}
                    onClick={onVoltar}
                >
                    {t('gameEnd.backToMenu')}
                </button>

                {/* Botão de Revanche */}
                {onRevanche && (
                    <button
                        className={`${styles.btnRevanche} ${fase >= 4 ? styles.visible : ''}`}
                        onClick={onRevanche}
                    >
                        {skinSolicitante && (
                            <img src={skinSolicitante} alt="" className={styles.revancheSkin} draggable={false} />
                        )}
                        {t('revanche.button')}
                    </button>
                )}
            </div>
        </div>
    );
}
