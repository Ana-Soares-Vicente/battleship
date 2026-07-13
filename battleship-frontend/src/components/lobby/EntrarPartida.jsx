import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { entrarJogoPorToken, getLobby, entrarJogo } from '../../services/api';
import { conectarWebSocket } from '../../services/websocket';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './EntrarPartida.module.css';

export default function EntrarPartida() {
    const [aba, setAba] = useState('TOKEN');
    const [token, setToken] = useState('');
    const [erro, setErro] = useState('');
    const [carregando, setCarregando] = useState(false);
    const [salas, setSalas] = useState([]);
    const [salaSelecionada, setSalaSelecionada] = useState(null);
    const [carregandoSalas, setCarregandoSalas] = useState(false);
    const navigate = useNavigate();
    const { t } = useTranslation();

    useEffect(() => {
        if (aba === 'SALAS') {
            carregarSalas();
        }
    }, [aba]);

    async function carregarSalas() {
        setCarregandoSalas(true);
        setErro('');
        try {
            const lista = await getLobby();
            setSalas(lista || []);
        } catch (err) {
            setErro(err.message || 'Erro ao buscar salas');
            setSalas([]);
        } finally {
            setCarregandoSalas(false);
        }
    }

    async function handleEntrarToken(e) {
        e.preventDefault();
        const tokenLimpo = token.trim().toUpperCase();
        if (!tokenLimpo) {
            setErro(t('joinMatch.enterCode'));
            return;
        }
        setErro('');
        setCarregando(true);
        try {
            await new Promise((resolve) => {
                conectarWebSocket(() => { resolve(); });
                setTimeout(resolve, 500);
            });
            const jogo = await entrarJogoPorToken(tokenLimpo);
            navigate(`/jogo/${jogo.id}`);
        } catch (err) {
            setErro(err.message || 'Código inválido ou sala não encontrada.');
        } finally {
            setCarregando(false);
        }
    }

    async function handleEntrarSala() {
        if (!salaSelecionada) return;
        setErro('');
        setCarregando(true);
        try {
            await new Promise((resolve) => {
                conectarWebSocket(() => { resolve(); });
                setTimeout(resolve, 500);
            });
            const jogo = await entrarJogo(salaSelecionada.id);
            navigate(`/jogo/${jogo.id || salaSelecionada.id}`);
        } catch (err) {
            setErro(err.message || 'Erro ao entrar na sala.');
        } finally {
            setCarregando(false);
        }
    }

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>{t('joinMatch.title')}</h1>

            {/* Abas */}
            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${aba === 'TOKEN' ? styles.tabAtiva : ''}`}
                    onClick={() => { setAba('TOKEN'); setErro(''); }}
                >
                    {t('joinMatch.byToken')}
                </button>
                <button
                    className={`${styles.tab} ${aba === 'SALAS' ? styles.tabAtiva : ''}`}
                    onClick={() => { setAba('SALAS'); setErro(''); }}
                >
                    {t('joinMatch.byRooms')}
                </button>
            </div>

            {/* Conteúdo */}
            <div className={styles.content}>
                {aba === 'TOKEN' && (
                    <form className={styles.tokenForm} onSubmit={handleEntrarToken}>
                        <div className={styles.section}>
                            <label className={styles.label}>{t('joinMatch.placeholder')}</label>
                            <input
                                className={styles.input}
                                type="text"
                                placeholder="A1B2C3"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                maxLength={10}
                                autoFocus
                            />
                        </div>
                        {erro && <p className={styles.erro}>{erro}</p>}
                    </form>
                )}

                {aba === 'SALAS' && (
                    <div className={styles.salasContainer}>
                        {carregandoSalas && (
                            <div className={styles.loadingRow}>
                                <div className={styles.spinner}></div>
                                <span className={styles.loadingText}>{t('game.loading')}</span>
                            </div>
                        )}

                        {!carregandoSalas && salas.length === 0 && (
                            <div className={styles.semSalas}>
                                <span>{t('joinMatch.noRooms')}</span>
                            </div>
                        )}

                        {erro && <p className={styles.erro}>{erro}</p>}

                        <div className={styles.listaServidor}>
                            {salas.map((sala) => (
                                <button
                                    key={sala.id}
                                    type="button"
                                    className={`${styles.servidorCard} ${salaSelecionada?.id === sala.id ? styles.servidorSelecionado : ''}`}
                                    onClick={() => setSalaSelecionada(sala)}
                                    onDoubleClick={() => { setSalaSelecionada(sala); handleEntrarSala(); }}
                                >
                                    <div className={styles.servidorInfo}>
                                        <span className={styles.servidorNome}>
                                            {sala.nome || `Partida de ${sala.jogador1 || 'Jogador'}`}
                                        </span>
                                        <span className={styles.servidorDetalhes}>
                                            Criador: {sala.jogador1 || '???'} • Código: {sala.token || '---'} • 1/2 jogadores
                                        </span>
                                    </div>
                                    <div className={styles.servidorStatus}>
                                        <span className={styles.statusDot}></span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Rodapé — Botões */}
            <div className={styles.footer}>
                {aba === 'TOKEN' && (
                    <>
                        <button
                            className={styles.btn}
                            onClick={handleEntrarToken}
                            disabled={carregando || !token.trim()}
                        >
                            {carregando ? t('joinMatch.loading') : t('joinMatch.join')}
                        </button>
                        <button className={`${styles.btn} ${styles.btnCancel}`} onClick={() => navigate('/lobby')}>
                            {t('joinMatch.back')}
                        </button>
                    </>
                )}

                {aba === 'SALAS' && (
                    <>
                        <div className={styles.footerRow}>
                            <button
                                className={styles.btn}
                                onClick={handleEntrarSala}
                                disabled={!salaSelecionada || carregando}
                            >
                                {carregando ? t('joinMatch.loading') : t('joinMatch.join')}
                            </button>
                        </div>
                        <div className={styles.footerRow}>
                            <button className={`${styles.btnHalf}`} onClick={carregarSalas} disabled={carregandoSalas}>
                                {t('joinMatch.refresh')}
                            </button>
                            <button className={`${styles.btnHalf} ${styles.btnCancel}`} onClick={() => navigate('/lobby')}>
                                {t('joinMatch.back')}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
