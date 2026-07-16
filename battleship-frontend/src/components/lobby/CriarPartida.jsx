import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { criarJogo, abandonarJogo } from '../../services/api';
import { conectarWebSocket, inscrever } from '../../services/websocket';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './CriarPartida.module.css';

const MODOS = [
    { id: 'PADRAO', labelKey: 'createMatch.modeStandard', descKey: 'createMatch.modeStandardDesc', img: '/img/modos/modo_padrao.png' },
    { id: 'EXPLOSAO', labelKey: 'createMatch.modeExplosion', descKey: 'createMatch.modeExplosionDesc', img: '/img/modos/modo_explosao.png' },
];

const DIFICULDADES = [
    { id: 'FACIL', labelKey: 'createMatch.diffEasy' },
    { id: 'MEDIO', labelKey: 'createMatch.diffMedium' },
    { id: 'DIFICIL', labelKey: 'createMatch.diffHard' },
];

export default function CriarPartida() {
    const [modoIndex, setModoIndex] = useState(0);
    const [dificuldadeIndex, setDificuldadeIndex] = useState(1);
    const [jogoCriado, setJogoCriado] = useState(null);
    const [copiado, setCopiado] = useState(false);
    const [criando, setCriando] = useState(false);
    const navigate = useNavigate();
    const unsubRef = useRef(null);
    const { t } = useTranslation();

    const modoAtual = MODOS[modoIndex];
    const dificuldadeAtual = DIFICULDADES[dificuldadeIndex];

    function ciclarModo() {
        if (criando || jogoCriado) return;
        setModoIndex((prev) => (prev + 1) % MODOS.length);
    }

    function ciclarDificuldade() {
        if (criando || jogoCriado) return;
        setDificuldadeIndex((prev) => (prev + 1) % DIFICULDADES.length);
    }

    async function handleCriarPartida() {
        setCriando(true);
        try {
            conectarWebSocket(() => {});
            const jogo = await criarJogo(MODOS[modoIndex].id);
            setJogoCriado({ id: jogo.id, token: jogo.token });

            unsubRef.current = inscrever(`/topic/jogo/${jogo.id}`, (evento) => {
                if (evento.tipo === 'JOGADOR_ENTROU') navegarParaJogo(jogo.id);
            });
        } catch (e) {
            alert(e.message);
        } finally {
            setCriando(false);
        }
    }

    function navegarParaJogo(jogoId) {
        if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
        navigate(`/jogo/${jogoId}`);
    }

    function handleCopiar() {
        if (jogoCriado?.token) {
            navigator.clipboard.writeText(jogoCriado.token);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 3000);
        }
    }

    function handleCancelar() {
        if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
        if (jogoCriado) {
            abandonarJogo(jogoCriado.id).catch(() => {});
        }
        navigate('/lobby');
    }

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>{t('createMatch.title')}</h1>

            <div className={styles.content}>
                {/* Modo de jogo + Dificuldade */}
                <div className={styles.btnRow}>
                    <button className={styles.btnOption} onClick={ciclarModo} disabled={criando || !!jogoCriado}>
                        {t('createMatch.gameMode')}: {t(modoAtual.labelKey)}
                    </button>
                    <button className={styles.btnOption} onClick={ciclarDificuldade} disabled={criando || !!jogoCriado}>
                        {t('createMatch.difficulty')}: {t(dificuldadeAtual.labelKey)}
                    </button>
                </div>

                {/* Descrição do modo */}
                <p className={styles.modoDesc}>{t(modoAtual.descKey)}</p>

                {/* Imagem do modo */}
                <div className={styles.imgContainer}>
                    <img
                        src={modoAtual.img}
                        alt={t(modoAtual.labelKey)}
                        className={styles.modoImg}
                        draggable={false}
                    />
                </div>

                {/* Token — só aparece após criar */}
                {jogoCriado && (
                    <div className={styles.field}>
                        <label className={styles.label}>{t('createMatch.code')}</label>
                        <input
                            className={styles.input}
                            value={jogoCriado.token}
                            readOnly
                        />
                        <button
                            className={styles.linkBtn}
                            onClick={handleCopiar}
                        >
                            {copiado ? `✓ ${t('createMatch.copied')}` : t('createMatch.copy')}
                        </button>
                    </div>
                )}

                {/* Aguardando jogador — só aparece após criar */}
                {jogoCriado && (
                    <div className={styles.waitingRow}>
                        <div className={styles.spinner}></div>
                        <span className={styles.waitingText}>{t('createMatch.waiting')}</span>
                    </div>
                )}
            </div>

            {/* Rodapé */}
            <div className={styles.footer}>
                <button className={`${styles.btnFooter} ${styles.btnCancel}`} onClick={handleCancelar}>
                    {t('createMatch.cancel')}
                </button>
                {!jogoCriado && (
                    <button
                        className={`${styles.btnFooter} ${styles.btnCreate}`}
                        onClick={handleCriarPartida}
                        disabled={criando}
                    >
                        {criando ? t('createMatch.creating') : t('createMatch.create')}
                    </button>
                )}
            </div>
        </div>
    );
}
