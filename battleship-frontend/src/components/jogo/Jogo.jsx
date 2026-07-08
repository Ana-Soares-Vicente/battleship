import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEstadoJogo, getMeusTiros, atirar, getMinhaFrota, getTirosRecebidos, getNaviosAfundadosInimigo } from '../../services/api';
import { conectarWebSocket, inscrever } from '../../services/websocket';
import audioManager from '../../services/audioManager';
import Posicionamento from './Posicionamento';
import Tabuleiro from './Tabuleiro';
import FrotaInimiga from './FrotaInimiga';
import styles from './Jogo.module.css';

// Minha skin: SEMPRE lida do localStorage (fonte de verdade única da /skins)
function getMinhaSkinEquipada() {
    return localStorage.getItem('skinAtual');
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
    const username = localStorage.getItem('username');
    const minhaSkin = getMinhaSkinEquipada();
    const unsubscribeRef = useRef(null);
    const loadingJaMostrouRef = useRef(false);

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
        let interval;
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
                        }
                        break;

                    case 'TIRO':
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
                            setTiros(prev => [...prev, {
                                linha: evento.linha,
                                coluna: evento.coluna,
                                resultado: evento.resultado,
                                tipoAfundado: evento.tipoAfundado,
                            }]);
                            if (evento.navioAfundado) {
                                setNaviosAfundados(prev => [...prev, evento.navioAfundado]);
                            }
                            if (evento.resultado === 'AFUNDOU') {
                                setBannerAfundou(true);
                                audioManager.playExplosion();
                                setTimeout(() => setBannerAfundou(false), 2500);
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
                                audioManager.playExplosion();
                            }
                        }

                        if (evento.fimDeJogo) {
                            setMsg(`Fim do Jogo! Vencedor: ${evento.vencedor}`);
                        } else if (evento.atirador === username) {
                            setMsg(`${evento.resultado}${evento.tipoAfundado ? ' - ' + evento.tipoAfundado : ''}`);
                        } else {
                            const info = evento.resultado === 'AGUA' ? 'errou' :
                                evento.resultado === 'ACERTO' ? 'acertou um navio seu!' :
                                `afundou seu ${evento.tipoAfundado}!`;
                            setMsg(`${evento.atirador} ${info}`);
                        }
                        break;

                    default:
                        break;
                }
            });
        }

        conectarWebSocket(() => {
            inscreverNoJogo();
            carregarEstado();
        });

        const fallbackTimeout = setTimeout(() => {
            inscreverNoJogo();
            carregarEstado();
        }, 1500);

        interval = setInterval(carregarEstado, 3000);

        return () => {
            clearTimeout(fallbackTimeout);
            clearInterval(interval);
            if (unsubscribeRef.current) unsubscribeRef.current();
        };
    }, [id, username, carregarEstado]);

    function handlePronto() {
        setJaPositionei(true);
        carregarEstado();
    }

    async function handleAtirar(linha, coluna) {
        setMsg('');
        try {
            await atirar(id, linha, coluna);
        } catch (e) {
            setMsg(e.message);
        }
    }

    // Tela de Loading — vídeo fullscreen antes do posicionamento
    if (mostrarLoading && !loadingFinalizado) {
        return (
            <div className={`${styles.loadingScreen} ${fadeOut ? styles.loadingFadeOut : ''}`}>
                <video
                    className={styles.loadingVideo}
                    src="/img/loading_page.mp4"
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

    if (!estado) return <div className={styles.container}><p className={styles.aguardando}>Carregando...</p></div>;

    const ehMeuTurno = estado.turnoAtual === username;
    const adversario = estado.jogador1 === username ? estado.jogador2 : estado.jogador1;

    // DEBUG: estado das skins no momento do render
    console.log('[SKINS] === RENDER Jogo.jsx ===');
    console.log('[SKINS] Minha skin (localStorage):', minhaSkin);
    console.log('[SKINS] Skin adversário (state):', skinAdversario);
    console.log('[SKINS] Adversário:', adversario);

    return (
        <div className={styles.container}>
            {/* Background oceano */}
            <div className={styles.bgOverlay} />

            {/* Minimapa decorativo — HUD top-left */}
            <img src="/img/mapa_base.png" alt="" className={styles.minimapa} />

            {/* ===== HEADER ===== */}
            {estado.status !== 'POSICIONANDO' && (
            <header className={styles.header}>
                <h1 className={styles.title}>MINECRAFT BATTLESHIP</h1>
                <div className={styles.playersRow}>
                    <div className={styles.playerSlot}>
                        {minhaSkin && <img src={minhaSkin} alt={username} className={styles.playerSkin} />}
                        <span className={styles.playerName}>{(username || '').toUpperCase()}</span>
                    </div>
                    <span className={styles.vs}>⚔</span>
                    <div className={styles.playerSlot}>
                        <span className={styles.playerName}>{(adversario || 'Aguardando...').toUpperCase()}</span>
                        {skinAdversario && <img src={skinAdversario} alt={adversario} className={styles.playerSkin} />}
                    </div>
                </div>
            </header>
            )}

            {/* ===== PRE-JOGO ===== */}
            {estado.status === 'AGUARDANDO' && (
                <div className={styles.preJogo}>
                    <p className={styles.aguardando}>Aguardando outro jogador entrar...</p>
                    {estado.token && (
                        <div className={styles.tokenSection}>
                            <p className={styles.tokenLabel}>Envie este código para seu oponente:</p>
                            <div className={styles.tokenDisplay}>
                                <code className={styles.tokenCode}>{estado.token}</code>
                                <button className={styles.btnCopiar} onClick={() => navigator.clipboard.writeText(estado.token)}>
                                    Copiar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {estado.status === 'POSICIONANDO' && !jaPositionei && (
                <Posicionamento jogoId={id} onPronto={handlePronto} jogador1={username} jogador2={adversario} minhaSkin={minhaSkin} skinAdversario={skinAdversario} />
            )}

            {estado.status === 'POSICIONANDO' && jaPositionei && (
                <div className={styles.aguardandoContainer}>
                    <div className={styles.aguardandoBg} />
                    <div className={styles.aguardandoContent}>
                        <h1 className={styles.aguardandoTitle}>MINECRAFT BATTLESHIP</h1>
                        <div className={styles.aguardandoPainel}>
                            <div className={styles.painelHeader}>
                                <span>AGUARDANDO OPONENTE<span className={styles.dots}>...</span></span>
                            </div>
                            <div className={styles.painelBody}>
                                <p className={styles.dicaTexto}>
                                    {[
                                        'Você só pode atacar uma casa por turno.',
                                        'Um barco afundado revela que todas as suas posições foram destruídas.',
                                        'Posicione barcos grandes longe das bordas para confundir o adversário.',
                                        'Espalhar os barcos dificulta que o inimigo encontre toda sua frota.',
                                        'No modo Explosão, um disparo pode atingir casas vizinhas.',
                                        'Os barcos não podem se sobrepor.',
                                        'Observe os padrões dos tiros do adversário.',
                                        'Após ambos terminarem o posicionamento, a partida começa automaticamente.',
                                        'Utilize estratégia, não apenas sorte.',
                                        'Cada barco possui uma quantidade diferente de blocos.',
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

            {/* ===== JOGO ===== */}
            {(estado.status === 'JOGANDO' || estado.status === 'FINALIZADO') && (
                <div className={styles.jogoArea}>
                    {/* Turno + Mensagem */}
                    {estado.status === 'JOGANDO' && (
                        <div className={styles.turnoBar}>
                            {ehMeuTurno ? (
                                <span className={styles.meuTurno}>⚔️ Sua vez — Ataque!</span>
                            ) : (
                                <span className={styles.aguardeTurno}>⏳ Aguarde seu turno</span>
                            )}
                        </div>
                    )}

                    {estado.status === 'FINALIZADO' && (
                        <div className={styles.resultadoBar}>
                            {estado.vencedor === username ? (
                                <span className={styles.vitoria}>🏆 Você Venceu!</span>
                            ) : (
                                <span className={styles.derrota}>💀 Game Over</span>
                            )}
                        </div>
                    )}

                    {msg && (
                        <p className={msg.includes('Fim do Jogo') ? styles.msgSucesso : styles.msgInfo}>{msg}</p>
                    )}

                    {bannerAfundou && (
                        <div className={styles.bannerAfundou}>💥 BARCO AFUNDADO!</div>
                    )}

                    {/* Tabuleiros lado a lado com frotas embaixo */}
                    <div className={styles.tabuleiros}>
                        <div className={styles.tabuleiroBloco}>
                            <h3 className={styles.tabTitulo}>Meu Porto</h3>
                            <div className={styles.boardFrame}>
                                <Tabuleiro
                                    modo="defesa"
                                    tiros={tirosRecebidos}
                                    naviosAfundados={naviosAfundadosMeus}
                                    meusNavios={meusNavios}
                                    onCelulaClick={() => {}}
                                    desabilitado={true}
                                />
                            </div>
                            <div className={styles.frotaAbaixo}>
                                <span className={styles.frotaLabel}>Minha Frota</span>
                                <FrotaInimiga
                                    naviosAfundados={naviosAfundadosMeus}
                                    tiros={tirosRecebidos}
                                />
                            </div>
                        </div>

                        <div className={`${styles.tabuleiroBloco} ${ehMeuTurno && estado.status === 'JOGANDO' ? styles.tabuleiroAtivo : ''}`}>
                            <h3 className={styles.tabTitulo}>Oceano Inimigo</h3>
                            <div className={`${styles.boardFrame} ${ehMeuTurno && estado.status === 'JOGANDO' ? styles.boardFrameAtivo : ''}`}>
                                <Tabuleiro
                                    modo="ataque"
                                    tiros={tiros}
                                    naviosAfundados={naviosAfundados}
                                    onCelulaClick={handleAtirar}
                                    desabilitado={!ehMeuTurno || estado.status === 'FINALIZADO'}
                                />
                            </div>
                            <div className={styles.frotaAbaixo}>
                                <span className={styles.frotaLabel}>Frota Inimiga</span>
                                <FrotaInimiga
                                    naviosAfundados={naviosAfundados}
                                    tiros={tiros}
                                    ehInimigo={true}
                                />
                            </div>
                        </div>
                    </div>

                    {estado.status === 'FINALIZADO' && (
                        <button className={styles.btnVoltar} onClick={() => navigate('/lobby')}>
                            Voltar ao Menu
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
