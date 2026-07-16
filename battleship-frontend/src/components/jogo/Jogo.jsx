import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEstadoJogo, getMeusTiros, atirar, getMinhaFrota, getTirosRecebidos, getNaviosAfundadosInimigo, atirarExplosao, getTirosDisponiveis } from '../../services/api';
import { conectarWebSocket, inscrever, desconectarWebSocket } from '../../services/websocket';
import audioManager from '../../services/audioManager';
import { useTranslation } from '../../i18n/useTranslation';
import Posicionamento from './Posicionamento';
import Tabuleiro from './Tabuleiro';
import FrotaInimiga from './FrotaInimiga';
import styles from './Jogo.module.css';

// Minha skin: SEMPRE lida do localStorage (fonte de verdade única da /skins)
function getMinhaSkinEquipada() {
    return localStorage.getItem('skinAtual') || '/img/skins/pactw_skin.webp';
}

export default function Jogo() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [estado, setEstado] = useState(null);
    const [tiros, setTiros] = useState([]);
    const [tirosRecebidos, setTirosRecebidos] = useState([]);
    const [naviosAfundados, setNaviosAfundados] = useState([]);
    const [naviosAfundadosMeus, setNaviosAfundadosMeus] = useState([]);
    const [meusNavios, setMeusNavios] = useState([]);
    const [msg, setMsg] = useState('');
    const [bannerAfundou, setBannerAfundou] = useState(false);
    const [jaPositionei, setJaPositionei] = useState(false);
    const [mostrarLoading, setMostrarLoading] = useState(true);
    const [loadingFinalizado, setLoadingFinalizado] = useState(false);
    const [fadeOut, setFadeOut] = useState(false);
    const [skinAdversario, setSkinAdversario] = useState(null);
    const [alvosExplosao, setAlvosExplosao] = useState([]); // [{linha, coluna}]
    const [tirosDisponiveis, setTirosDisponiveis] = useState(0);
    const [processandoExplosao, setProcessandoExplosao] = useState(false);
    const [abandonou, setAbandonou] = useState(null);
    const username = localStorage.getItem('username');
    const minhaSkin = getMinhaSkinEquipada();
    const { t } = useTranslation();
    const unsubscribeRef = useRef(null);
    const loadingJaMostrouRef = useRef(false);
    const estadoRef = useRef(null);
    // Rastrear tiros que já tiveram som tocado (evita duplicação HTTP + WebSocket)
    const tirosComSomRef = useRef(new Set());

    // Manter ref sincronizada para uso em setInterval
    useEffect(() => { estadoRef.current = estado; }, [estado]);

    const carregarEstado = useCallback(async () => {
        try {
            const e = await getEstadoJogo(id);
            setEstado(e);
            // DEBUG: skins recebidas do backend
            console.log('[SKINS] Skin equipada (localStorage):', localStorage.getItem('skinAtual'));
            console.log('[SKINS] Jogador atual:', username);
            console.log('[SKINS] Dados recebidos do backend:', {
                skinJogador1: e.skinJogador1,
                skinJogador2: e.skinJogador2,
                jogador1: e.jogador1,
                jogador2: e.jogador2,
                status: e.status,
            });
            // Adversário: ler do backend (é a única forma de saber qual skin o outro escolheu)
            if (e.jogador1 === username) {
                // Eu sou jogador1 → adversário é jogador2
                console.log('[SKINS] Eu sou jogador1 → skin adversário (skinJogador2):', e.skinJogador2);
                if (e.skinJogador2) setSkinAdversario(e.skinJogador2);
            } else {
                // Eu sou jogador2 → adversário é jogador1
                console.log('[SKINS] Eu sou jogador2 → skin adversário (skinJogador1):', e.skinJogador1);
                if (e.skinJogador1) setSkinAdversario(e.skinJogador1);
            }
            if (e.status === 'JOGANDO' || e.status === 'FINALIZADO') {
                const t = await getMeusTiros(id);
                setTiros(t);

                const afundados = t
                    .filter(tiro => tiro.navioAfundado)
                    .map(tiro => tiro.navioAfundado);
                if (afundados.length > 0) {
                    setNaviosAfundados(afundados);
                } else {
                    try {
                        const navAfundados = await getNaviosAfundadosInimigo(id);
                        if (navAfundados && navAfundados.length > 0) {
                            setNaviosAfundados(navAfundados);
                        }
                    } catch { /* */ }
                }

                try {
                    const frota = await getMinhaFrota(id);
                    if (frota) setMeusNavios(frota);
                } catch { /* */ }

                try {
                    const recebidos = await getTirosRecebidos(id);
                    if (recebidos) {
                        setTirosRecebidos(recebidos);
                        const afundadosMeus = recebidos
                            .filter(tiro => tiro.navioAfundado)
                            .map(tiro => tiro.navioAfundado);
                        if (afundadosMeus.length > 0) {
                            setNaviosAfundadosMeus(afundadosMeus);
                        }
                    }
                } catch { /* */ }

                if (e.modo === 'EXPLOSAO') {
                    try {
                        const td = await getTirosDisponiveis(id);
                        if (td) setTirosDisponiveis(td.tirosDisponiveis);
                    } catch { /* */ }
                }
            }
            if (e.status === 'POSICIONANDO' || e.status === 'JOGANDO') {
                if (e.meusProntos) {
                    setJaPositionei(true);
                }
                // Jogador 2: mostrar loading na primeira vez que vê POSICIONANDO
                if (e.status === 'POSICIONANDO' && !loadingJaMostrouRef.current && !e.meusProntos) {
                    loadingJaMostrouRef.current = true;
                    setMostrarLoading(true);
                }
            }
        } catch (e) {
            console.error(e);
        }
    }, [id]);

    useEffect(() => {
        let inscrito = false;

        function inscreverNoJogo() {
            if (inscrito) return;
            inscrito = true;

            unsubscribeRef.current = inscrever(`/topic/jogo/${id}`, (evento) => {
                switch (evento.tipo) {
                    case 'JOGADOR_ENTROU':
                        console.log('[SKINS] WebSocket JOGADOR_ENTROU recebido:', evento);
                        setEstado(prev => prev ? {
                            ...prev,
                            jogador2: evento.jogador2,
                            status: evento.status,
                        } : prev);
                        if (evento.skinJogador2) {
                            console.log('[SKINS] Skin do adversário recebida via WebSocket:', evento.skinJogador2);
                            setSkinAdversario(evento.skinJogador2);
                        } else {
                            console.warn('[SKINS] WebSocket JOGADOR_ENTROU NÃO trouxe skinJogador2!');
                        }
                        // Disparar loading screen
                        if (!loadingJaMostrouRef.current) {
                            loadingJaMostrouRef.current = true;
                            setMostrarLoading(true);
                        }
                        break;

                    case 'JOGADOR_PRONTO':
                        setEstado(prev => {
                            if (!prev) return prev;
                            const novo = { ...prev, status: evento.status };
                            if (evento.turnoAtual) novo.turnoAtual = evento.turnoAtual;
                            return novo;
                        });
                        if (evento.status === 'JOGANDO') {
                            getMeusTiros(id).then(setTiros).catch(console.error);
                            getMinhaFrota(id).then(f => { if (f) setMeusNavios(f); }).catch(() => {});
                            getTirosRecebidos(id).then(r => { if (r) setTirosRecebidos(r); }).catch(() => {});
                            getTirosDisponiveis(id).then(td => { if (td) setTirosDisponiveis(td.tirosDisponiveis); }).catch(() => {});
                        }
                        break;

                    case 'TIRO':
                        console.log(`[WS TIRO RECEBIDO] atirador=${evento.atirador} turnoAtual=${evento.turnoAtual} eu=${username} ts=${Date.now()}`);
                        setEstado(prev => {
                            if (!prev) return prev;
                            const novo = { ...prev, turnoAtual: evento.turnoAtual };
                            if (evento.fimDeJogo) {
                                novo.status = 'FINALIZADO';
                                novo.vencedor = evento.vencedor;
                            }
                            return novo;
                        });

                        if (evento.atirador === username) {
                            setTiros(prev => {
                                // Se HTTP já processou este tiro, não duplicar
                                const jaProcessado = prev.some(t => t.linha === evento.linha && t.coluna === evento.coluna && t.resultado !== 'PENDENTE');
                                if (jaProcessado) return prev;
                                // Substituir tiro pendente pelo resultado real
                                const semPendente = prev.filter(t => !(t.linha === evento.linha && t.coluna === evento.coluna && t.resultado === 'PENDENTE'));
                                return [...semPendente, {
                                    linha: evento.linha,
                                    coluna: evento.coluna,
                                    resultado: evento.resultado,
                                    tipoAfundado: evento.tipoAfundado,
                                }];
                            });
                            if (evento.navioAfundado) {
                                setNaviosAfundados(prev => {
                                    const jaTemEsse = prev.some(n => n.linhaInicial === evento.navioAfundado.linhaInicial && n.colunaInicial === evento.navioAfundado.colunaInicial);
                                    if (jaTemEsse) return prev;
                                    return [...prev, evento.navioAfundado];
                                });
                                const chave = `${evento.linha},${evento.coluna}`;
                                if (!tirosComSomRef.current.has(chave)) {
                                    tirosComSomRef.current.add(chave);
                                    setBannerAfundou(true);
                                    audioManager.playTntHit();
                                    setTimeout(() => setBannerAfundou(false), 2500);
                                }
                            } else {
                                const chave = `${evento.linha},${evento.coluna}`;
                                if (!tirosComSomRef.current.has(chave)) {
                                    tirosComSomRef.current.add(chave);
                                    if (evento.resultado === 'AGUA') {
                                        estadoRef.current?.modo === 'EXPLOSAO' ? audioManager.playMinecraftHit() : audioManager.playSplash();
                                    }
                                }
                            }
                        } else {
                            setTirosRecebidos(prev => [...prev, {
                                linha: evento.linha,
                                coluna: evento.coluna,
                                resultado: evento.resultado,
                                tipoAfundado: evento.tipoAfundado,
                            }]);
                            if (evento.navioAfundado) {
                                setNaviosAfundadosMeus(prev => [...prev, evento.navioAfundado]);
                                audioManager.playTntHit();
                            } else if (evento.resultado === 'AGUA') {
                                estadoRef.current?.modo === 'EXPLOSAO' ? audioManager.playMinecraftHit() : audioManager.playSplash();
                            }
                        }

                        if (evento.fimDeJogo) {
                            setMsg('');
                        } else if (evento.atirador === username) {
                            setMsg(`${evento.resultado}${evento.tipoAfundado ? ' - ' + evento.tipoAfundado : ''}`);
                        } else {
                            const info = evento.resultado === 'AGUA' ? t('game.missed') :
                                evento.resultado === 'ACERTO' ? t('game.hitYourShip') :
                                `${t('game.sunkYour')} ${evento.tipoAfundado}!`;
                            setMsg(`${evento.atirador} ${info}`);
                        }
                        break;

                    case 'TIROS_EXPLOSAO':
                        setEstado(prev => {
                            if (!prev) return prev;
                            const novo = { ...prev, turnoAtual: evento.turnoAtual };
                            if (evento.fimDeJogo) {
                                novo.status = 'FINALIZADO';
                                novo.vencedor = evento.vencedor;
                            }
                            return novo;
                        });

                        if (evento.atirador === username) {
                            setTiros(prev => {
                                const novos = evento.tiros.map(t => ({
                                    linha: t.linha,
                                    coluna: t.coluna,
                                    resultado: t.resultado,
                                    tipoAfundado: t.tipoAfundado,
                                }));
                                const semPendentes = prev.filter(p => p.resultado !== 'PENDENTE');
                                return [...semPendentes, ...novos];
                            });
                            const afundadosExp = evento.tiros.filter(t => t.navioAfundado).map(t => t.navioAfundado);
                            if (afundadosExp.length > 0) {
                                setNaviosAfundados(prev => {
                                    const novos = afundadosExp.filter(a => !prev.some(p => p.linhaInicial === a.linhaInicial && p.colunaInicial === a.colunaInicial));
                                    return [...prev, ...novos];
                                });
                                setBannerAfundou(true);
                                setTimeout(() => setBannerAfundou(false), 2500);
                            }
                            // Feedback sonoro — evita duplicação com HTTP
                            evento.tiros.forEach((t, i) => {
                                setTimeout(() => {
                                    const chave = `${t.linha},${t.coluna}`;
                                    if (!tirosComSomRef.current.has(chave)) {
                                        tirosComSomRef.current.add(chave);
                                        if (t.navioAfundado) {
                                            audioManager.playTntHit();
                                        } else if (t.resultado === 'AGUA') {
                                            audioManager.playMinecraftHit();
                                        }
                                    }
                                }, i * 150);
                            });
                            setAlvosExplosao([]);
                            setProcessandoExplosao(false);
                        } else {
                            setTirosRecebidos(prev => [...prev, ...evento.tiros.map(t => ({
                                linha: t.linha,
                                coluna: t.coluna,
                                resultado: t.resultado,
                                tipoAfundado: t.tipoAfundado,
                            }))]);
                            const afundadosExp = evento.tiros.filter(t => t.navioAfundado).map(t => t.navioAfundado);
                            if (afundadosExp.length > 0) {
                                setNaviosAfundadosMeus(prev => [...prev, ...afundadosExp]);
                            }
                            // Feedback sonoro para tiros recebidos no modo explosão
                            evento.tiros.forEach((t, i) => {
                                setTimeout(() => {
                                    if (t.navioAfundado) {
                                        audioManager.playTntHit();
                                    } else if (t.resultado === 'AGUA') {
                                        audioManager.playMinecraftHit();
                                    }
                                }, i * 150);
                            });
                        }

                        if (!evento.fimDeJogo) {
                            getTirosDisponiveis(id).then(td => { if (td) setTirosDisponiveis(td.tirosDisponiveis); }).catch(() => {});
                        }

                        if (evento.fimDeJogo) {
                            setMsg('');
                        } else {
                            const acertosExp = evento.tiros.filter(t => t.resultado !== 'AGUA').length;
                            const errosExp = evento.tiros.filter(t => t.resultado === 'AGUA').length;
                            if (evento.atirador === username) {
                                setMsg(`${acertosExp} ${t('game.hits')}, ${errosExp} ${t('game.misses')}`);
                            } else {
                                setMsg(`${evento.atirador} ${t('game.firedShots')} ${evento.tiros.length} ${t('game.shotsWord')}`);
                            }
                        }
                        break;

                    case 'ABANDONO':
                        setAbandonou(evento);
                        setEstado(prev => prev ? {...prev, status: 'FINALIZADO', vencedor: evento.vencedor} : prev);
                        break;

                    default:
                        break;
                }
            });
        }

        let wsConectou = false;

        conectarWebSocket(() => {
            wsConectou = true;
            inscreverNoJogo();
            carregarEstado();
        });

        // Fallback único: se WebSocket não conectou em 5s, carrega estado uma vez
        const fallbackTimeout = setTimeout(() => {
            if (!wsConectou) {
                console.warn('[WS] Fallback: WebSocket não conectou em 5s, carregando estado via GET');
                inscreverNoJogo();
                carregarEstado();
            }
        }, 5000);

        // Listener para desconectar WebSocket ao sair da página
        const handleBeforeUnload = () => {
            desconectarWebSocket();
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            clearTimeout(fallbackTimeout);
            if (unsubscribeRef.current) unsubscribeRef.current();
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [id, username, carregarEstado]);

    function handlePronto() {
        setJaPositionei(true);
        carregarEstado();
    }

    async function handleAtirar(linha, coluna) {
        const t0 = performance.now();
        console.log(`[TIRO CLICADO] pos=${linha},${coluna} ts=${Date.now()}`);
        setMsg('');
        // Optimistic update — marca a célula imediatamente como "pendente" para feedback instantâneo
        const tiroPendente = { linha, coluna, resultado: 'PENDENTE' };
        setTiros(prev => [...prev, tiroPendente]);
        console.log(`[TABULEIRO ATUALIZADO] optimistic em ${(performance.now() - t0).toFixed(1)}ms`);
        try {
            console.log(`[REQUISIÇÃO ENVIADA] ts=${Date.now()}`);
            const res = await atirar(id, linha, coluna);
            console.log(`[RESPOSTA RECEBIDA] tempo_total=${(performance.now() - t0).toFixed(1)}ms`);
            // Atualizar imediatamente com a resposta HTTP (não esperar WebSocket)
            if (res) {
                setTiros(prev => {
                    const semPendente = prev.filter(t => !(t.linha === linha && t.coluna === coluna && t.resultado === 'PENDENTE'));
                    // Se WebSocket já substituiu, não duplicar
                    const jaExiste = semPendente.some(t => t.linha === linha && t.coluna === coluna && t.resultado !== 'PENDENTE');
                    if (jaExiste) return semPendente;
                    return [...semPendente, {
                        linha: res.linha,
                        coluna: res.coluna,
                        resultado: res.resultado,
                        tipoAfundado: res.tipoAfundado,
                    }];
                });
                // Atualizar turno e estado do jogo imediatamente
                if (res.fimDeJogo) {
                    setEstado(prev => prev ? { ...prev, status: 'FINALIZADO', vencedor: res.vencedor, turnoAtual: null } : prev);
                    setMsg('');
                } else {
                    setEstado(prev => prev ? { ...prev, turnoAtual: res.turnoAtual } : prev);
                    setMsg(`${res.resultado}${res.tipoAfundado ? ' - ' + res.tipoAfundado : ''}`);
                }
                // Navio afundado
                if (res.navioAfundado) {
                    setNaviosAfundados(prev => {
                        const jaTemEsse = prev.some(n => n.linhaInicial === res.navioAfundado.linhaInicial && n.colunaInicial === res.navioAfundado.colunaInicial);
                        if (jaTemEsse) return prev;
                        return [...prev, res.navioAfundado];
                    });
                    setBannerAfundou(true);
                    audioManager.playTntHit();
                    setTimeout(() => setBannerAfundou(false), 2500);
                } else if (res.resultado === 'AGUA') {
                    estado?.modo === 'EXPLOSAO' ? audioManager.playMinecraftHit() : audioManager.playSplash();
                }
                // Marcar tiro como já tocado (evitar duplicação com WebSocket)
                tirosComSomRef.current.add(`${res.linha},${res.coluna}`);
            }
        } catch (e) {
            // Reverter tiro pendente em caso de erro
            setTiros(prev => prev.filter(t => !(t.linha === linha && t.coluna === coluna && t.resultado === 'PENDENTE')));
            setMsg(e.message);
        }
    }

    // ========================= //
    // MODO EXPLOSÃO — HANDLERS  //
    // ========================= //

    function handleCelulaClickExplosao(linha, coluna) {
        setAlvosExplosao(prev => {
            const jaExiste = prev.some(a => a.linha === linha && a.coluna === coluna);
            if (jaExiste) {
                return prev.filter(a => !(a.linha === linha && a.coluna === coluna));
            }
            if (prev.length >= tirosDisponiveis) return prev;
            return [...prev, { linha, coluna }];
        });
    }

    async function handleConfirmarExplosao() {
        if (alvosExplosao.length !== tirosDisponiveis) return;
        setProcessandoExplosao(true);
        setMsg('');
        setTiros(prev => [...prev, ...alvosExplosao.map(a => ({ linha: a.linha, coluna: a.coluna, resultado: 'PENDENTE' }))]);
        try {
            const res = await atirarExplosao(id, alvosExplosao);
            if (res) {
                setTiros(prev => {
                    const semPendentes = prev.filter(p => p.resultado !== 'PENDENTE');
                    const novos = res.map(t => ({ linha: t.linha, coluna: t.coluna, resultado: t.resultado, tipoAfundado: t.tipoAfundado }));
                    return [...semPendentes, ...novos];
                });
                const afundados = res.filter(t => t.navioAfundado).map(t => t.navioAfundado);
                if (afundados.length > 0) {
                    setNaviosAfundados(prev => {
                        const novos = afundados.filter(a => !prev.some(p => p.linhaInicial === a.linhaInicial && p.colunaInicial === a.colunaInicial));
                        return [...prev, ...novos];
                    });
                    setBannerAfundou(true);
                    setTimeout(() => setBannerAfundou(false), 2500);
                }
                // Feedback sonoro para cada tiro do modo explosão
                res.forEach((t, i) => {
                    setTimeout(() => {
                        tirosComSomRef.current.add(`${t.linha},${t.coluna}`);
                        if (t.navioAfundado) {
                            audioManager.playTntHit();
                        } else if (t.resultado === 'AGUA') {
                            audioManager.playMinecraftHit();
                        }
                    }, i * 150);
                });
                const ultimoResultado = res[res.length - 1];
                if (ultimoResultado) {
                    if (ultimoResultado.fimDeJogo) {
                        setEstado(prev => prev ? { ...prev, status: 'FINALIZADO', vencedor: ultimoResultado.vencedor } : prev);
                    } else {
                        setEstado(prev => prev ? { ...prev, turnoAtual: ultimoResultado.turnoAtual } : prev);
                    }
                }
                const acertos = res.filter(t => t.resultado !== 'AGUA').length;
                const erros = res.filter(t => t.resultado === 'AGUA').length;
                setMsg(`${acertos} ${t('game.hits')}, ${erros} ${t('game.misses')}`);
                setAlvosExplosao([]);
                // Fetch updated tiros disponiveis
                try {
                    const td = await getTirosDisponiveis(id);
                    if (td) setTirosDisponiveis(td.tirosDisponiveis);
                } catch { /* */ }
            }
        } catch (e) {
            setTiros(prev => prev.filter(t => t.resultado !== 'PENDENTE'));
            setMsg(e.message);
            setAlvosExplosao([]);
        } finally {
            setProcessandoExplosao(false);
        }
    }

    // Tela de Loading — vídeo fullscreen antes do posicionamento
    if (mostrarLoading && !loadingFinalizado) {
        return (
            <div className={`${styles.loadingScreen} ${fadeOut ? styles.loadingFadeOut : ''}`}>
                <video
                    className={styles.loadingVideo}
                    src="/img/ui/loading_page.mp4"
                    autoPlay
                    muted
                    playsInline
                    onEnded={() => {
                        setFadeOut(true);
                        setTimeout(() => {
                            setLoadingFinalizado(true);
                        }, 800);
                    }}
                />
            </div>
        );
    }

    if (!estado) return <div className={styles.container}><p className={styles.aguardando}>{t('game.loading')}</p></div>;

    const ehMeuTurno = estado.turnoAtual === username;
    const adversario = estado.jogador1 === username ? estado.jogador2 : estado.jogador1;

    // DEBUG: estado das skins no momento do render
    console.log('[SKINS] === RENDER Jogo.jsx ===');
    console.log('[SKINS] Minha skin (localStorage):', minhaSkin);
    console.log('[SKINS] Skin adversário (state):', skinAdversario);
    console.log('[SKINS] Adversário:', adversario);

    return (
        <>
            {estado.status === 'POSICIONANDO' && jaPositionei && (
                <div className={styles.aguardandoContainer}>
                    {estado?.modo === 'EXPLOSAO' ? (
                        <video className={styles.aguardandoVideo} src="/img/fundos/nether_video_modoexplosao.mp4" autoPlay loop muted playsInline ref={el => { if (el) el.playbackRate = 0.6; }} />
                    ) : (
                        <video className={styles.aguardandoVideo} src="/img/fundos/fundo_padrao_peixes_mexendo.mp4" autoPlay loop muted playsInline />
                    )}
                    <div className={styles.aguardandoContent}>
                        <h1 className={styles.aguardandoTitle}>MINECRAFT BATTLESHIP</h1>
                        <div className={styles.aguardandoPainel}>
                            <div className={styles.painelHeader}>
                                <span>{t('game.waitingOpponent')}<span className={styles.dots}>...</span></span>
                            </div>
                            <div className={styles.painelBody}>
                                <p className={styles.dicaTexto}>
                                    {[
                                        t('tips.0'), t('tips.1'), t('tips.2'), t('tips.3'), t('tips.4'),
                                        t('tips.5'), t('tips.6'), t('tips.7'), t('tips.8'), t('tips.9'),
                                    ][Math.floor(Math.random() * 10)]}
                                </p>
                            </div>
                            <div className={styles.painelFooter}>
                                <div className={styles.loadBar}>
                                    <div className={styles.loadBarFill} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        <div className={styles.container}>
            {/* Background — não renderiza durante posicionamento (Posicionamento.jsx tem o seu próprio) */}
            {!(estado.status === 'POSICIONANDO' && !jaPositionei) && (
                estado?.modo === 'EXPLOSAO' ? (
                    <video className={styles.bgVideo} src="/img/fundos/nether_video_modoexplosao.mp4" autoPlay loop muted playsInline ref={el => { if (el) el.playbackRate = 0.6; }} />
                ) : (
                    <video className={styles.bgVideo} src="/img/fundos/fundo_padrao_peixes_mexendo.mp4" autoPlay loop muted playsInline />
                )
            )}



            {/* ===== HEADER ===== */}
            {estado.status !== 'POSICIONANDO' && (
            <header className={styles.header}>
                <h1 className={styles.title}>MINECRAFT BATTLESHIP</h1>
            </header>
            )}

            {/* ===== PRE-JOGO ===== */}
            {estado.status === 'AGUARDANDO' && (
                <div className={styles.preJogo}>
                    <p className={styles.aguardando}>{t('game.waitingPlayer')}</p>
                    {estado.token && (
                        <div className={styles.tokenSection}>
                            <p className={styles.tokenLabel}>{t('game.sendCode')}</p>
                            <div className={styles.tokenDisplay}>
                                <code className={styles.tokenCode}>{estado.token}</code>
                                <button className={styles.btnCopiar} onClick={() => navigator.clipboard.writeText(estado.token)}>
                                    {t('game.copy')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {estado.status === 'POSICIONANDO' && !jaPositionei && (
                <Posicionamento jogoId={id} onPronto={handlePronto} jogador1={username} jogador2={adversario} minhaSkin={minhaSkin} skinAdversario={skinAdversario} modo={estado.modo} />
            )}

            {/* ===== JOGO ===== */}
            {(estado.status === 'JOGANDO' || estado.status === 'FINALIZADO') && (
                <div className={styles.jogoArea}>
                    {/* Status Area — altura fixa, nunca empurra os tabuleiros */}
                    <div className={styles.statusArea}>
                        {estado.status === 'JOGANDO' && (
                            <div className={styles.turnoBar}>
                                {ehMeuTurno ? (
                                    <span className={styles.meuTurno}>⚔️ {t('game.yourTurn')}</span>
                                ) : (
                                    <span className={styles.aguardeTurno}>⏳ {t('game.waitTurn')}</span>
                                )}
                            </div>
                        )}

                        {estado.status === 'FINALIZADO' && (
                            <div className={styles.resultadoBar}>
                                {estado.vencedor === username ? (
                                    <span className={styles.vitoria}>🏆 {t('game.youWon')} @{username}</span>
                                ) : (
                                    <span className={styles.derrota}>💀 {t('game.gameOver')} @{username}</span>
                                )}
                            </div>
                        )}

                        <p className={styles.msgInfo} style={{ visibility: msg ? 'visible' : 'hidden' }}>{msg || '\u00A0'}</p>

                        {estado.modo === 'EXPLOSAO' && estado.status === 'JOGANDO' && (
                            <div className={styles.explosaoBar} style={{ visibility: ehMeuTurno ? 'visible' : 'hidden' }}>
                                <span className={styles.explosaoLabel}>💣 {t('game.shots')}: {alvosExplosao.length}/{tirosDisponiveis}</span>
                                <button
                                    className={styles.btnConfirmar}
                                    onClick={handleConfirmarExplosao}
                                    disabled={processandoExplosao || alvosExplosao.length !== tirosDisponiveis || tirosDisponiveis === 0}
                                    style={{ visibility: (alvosExplosao.length === tirosDisponiveis && tirosDisponiveis > 0) ? 'visible' : 'hidden' }}
                                >
                                    {processandoExplosao ? t('game.firing') : t('game.confirmAttack')}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Tabuleiros lado a lado */}
                    <div className={styles.tabuleiros}>
                        {/* Banner afundou — overlay absoluto, não empurra nada */}
                        {bannerAfundou && (
                            <div className={styles.bannerAfundou}>💥 {t('game.shipSunk')}</div>
                        )}

                        {/* MINHA FROTA (lateral esquerda) */}
                        <div className={styles.frotaLateral}>
                            <span className={styles.frotaLabel}>{t('game.myFleet')}</span>
                            <FrotaInimiga
                                naviosAfundados={naviosAfundadosMeus}
                                tiros={tirosRecebidos}
                                modoJogo={estado.modo}
                            />
                        </div>

                        {/* MEU PORTO */}
                        <div className={styles.tabuleiroBloco}>
                            <div className={styles.tabHeader}>
                                {minhaSkin && <img src={minhaSkin} alt={username} className={styles.tabSkin} />}
                                <div className={styles.tabHeaderText}>
                                    <h3 className={styles.tabTitulo}>{t('game.myPort')}</h3>
                                    <span className={styles.tabNome}>{(username || '').toUpperCase()}</span>
                                </div>
                            </div>
                            <div className={styles.boardFrame}>
                                <Tabuleiro
                                    modo="defesa"
                                    tiros={tirosRecebidos}
                                    naviosAfundados={naviosAfundadosMeus}
                                    meusNavios={meusNavios}
                                    onCelulaClick={() => {}}
                                    desabilitado={true}
                                    modoJogo={estado.modo}
                                />
                            </div>
                        </div>

                        {/* OCEANO INIMIGO */}
                        <div className={`${styles.tabuleiroBloco} ${ehMeuTurno && estado.status === 'JOGANDO' ? (estado.modo === 'EXPLOSAO' ? styles.tabuleiroAtivoExplosao : styles.tabuleiroAtivo) : ''}`}>
                            <div className={styles.tabHeader}>
                                <div className={styles.tabHeaderText}>
                                    <h3 className={styles.tabTitulo}>{t('game.enemyOcean')}</h3>
                                    <span className={styles.tabNome}>{(adversario || '...').toUpperCase()}</span>
                                </div>
                                {skinAdversario && <img src={skinAdversario} alt={adversario} className={styles.tabSkin} />}
                            </div>
                            <div className={`${styles.boardFrame} ${ehMeuTurno && estado.status === 'JOGANDO' ? (estado.modo === 'EXPLOSAO' ? styles.boardFrameAtivoExplosao : styles.boardFrameAtivo) : ''}`}>
                                <Tabuleiro
                                    modo="ataque"
                                    tiros={tiros}
                                    naviosAfundados={naviosAfundados}
                                    onCelulaClick={estado.modo === 'EXPLOSAO' ? handleCelulaClickExplosao : handleAtirar}
                                    desabilitado={!ehMeuTurno || estado.status === 'FINALIZADO' || processandoExplosao}
                                    alvosExplosao={estado.modo === 'EXPLOSAO' ? alvosExplosao : []}
                                    modoJogo={estado.modo}
                                />
                            </div>
                        </div>

                        {/* FROTA INIMIGA (lateral direita) */}
                        <div className={styles.frotaLateral}>
                            <span className={styles.frotaLabel}>{t('game.enemyFleet')}</span>
                            <FrotaInimiga
                                naviosAfundados={naviosAfundados}
                                tiros={tiros}
                                ehInimigo={true}
                                modoJogo={estado.modo}
                            />
                        </div>
                    </div>

                    {estado.status === 'FINALIZADO' && (
                        <button className={styles.btnVoltar} onClick={() => navigate('/lobby')}>
                            {t('game.backToMenu')}
                        </button>
                    )}

                </div>
            )}
        </div>
        {abandonou && (
            <div className={styles.abandonouOverlay}>
                <div className={styles.abandonouModal}>
                    <h2 className={styles.abandonouTitulo}>⚠️ O adversário saiu da partida</h2>
                    <p className={styles.abandonouMsg}>Você venceu por WO!</p>
                    <button className={styles.btnVoltar} onClick={() => navigate('/lobby')}>
                        Voltar ao Lobby
                    </button>
                </div>
            </div>
        )}
        </>
    );
}
