import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { criarJogo, getEstadoJogo } from '../../services/api';
import { conectarWebSocket, inscrever } from '../../services/websocket';
import styles from './CriarPartida.module.css';

const MODOS = [
    { id: 'PADRAO', label: 'padrão', desc: 'Busque recursos, fabrique ferramentas,\nsuba de nível e coma para se manter vivo', img: '/img/modo_padrao.png' },
    { id: 'EXPLOSAO', label: 'explosão', desc: 'Modo alternativo com mecânicas\nde explosão e regras especiais', img: '/img/modo_explosao.png' },
];

const DIFICULDADES = [
    { id: 'FACIL', label: 'fácil' },
    { id: 'MEDIO', label: 'médio' },
    { id: 'DIFICIL', label: 'difícil' },
];

export default function CriarPartida() {
    const [nomeServidor, setNomeServidor] = useState('');
    const [modoIndex, setModoIndex] = useState(0);
    const [dificuldadeIndex, setDificuldadeIndex] = useState(1);
    const [jogoCriado, setJogoCriado] = useState(null);
    const [copiado, setCopiado] = useState(false);
    const [criando, setCriando] = useState(false);
    const navigate = useNavigate();
    const unsubRef = useRef(null);
    const pollingRef = useRef(null);

    const modoAtual = MODOS[modoIndex];
    const dificuldadeAtual = DIFICULDADES[dificuldadeIndex];
    const criadoRef = useRef(false);

    useEffect(() => {
        conectarWebSocket(() => {});
        if (!criadoRef.current) {
            criadoRef.current = true;
            criarPartidaAuto();
        }
        return () => {
            if (unsubRef.current) unsubRef.current();
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    async function criarPartidaAuto() {
        setCriando(true);
        try {
            const jogo = await criarJogo(MODOS[modoIndex].id);
            setJogoCriado({ id: jogo.id, token: jogo.token });

            unsubRef.current = inscrever(`/topic/jogo/${jogo.id}`, (evento) => {
                if (evento.tipo === 'JOGADOR_ENTROU') navegarParaJogo(jogo.id);
            });

            pollingRef.current = setInterval(async () => {
                try {
                    const estado = await getEstadoJogo(jogo.id);
                    if (estado.status !== 'AGUARDANDO') navegarParaJogo(jogo.id);
                } catch (err) { console.error(err); }
            }, 2000);
        } catch (e) {
            alert(e.message);
        } finally {
            setCriando(false);
        }
    }

    function navegarParaJogo(jogoId) {
        if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
        if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
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
        if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
        navigate('/lobby');
    }

    function ciclarModo() {
        if (criando) return;
        // Cancelar sala atual
        if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
        if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
        // NÃO limpar jogoCriado para evitar layout shift — será substituído pelo novo
        const novoIndex = (modoIndex + 1) % MODOS.length;
        setModoIndex(novoIndex);
        criarComModo(novoIndex);
    }

    async function criarComModo(idx) {
        setCriando(true);
        try {
            const jogo = await criarJogo(MODOS[idx].id);
            setJogoCriado({ id: jogo.id, token: jogo.token });

            unsubRef.current = inscrever(`/topic/jogo/${jogo.id}`, (evento) => {
                if (evento.tipo === 'JOGADOR_ENTROU') navegarParaJogo(jogo.id);
            });

            pollingRef.current = setInterval(async () => {
                try {
                    const estado = await getEstadoJogo(jogo.id);
                    if (estado.status !== 'AGUARDANDO') navegarParaJogo(jogo.id);
                } catch (err) { console.error(err); }
            }, 2000);
        } catch (e) {
            alert(e.message);
        } finally {
            setCriando(false);
        }
    }

    function ciclarDificuldade() {
        setDificuldadeIndex((prev) => (prev + 1) % DIFICULDADES.length);
    }

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>Criar uma nova partida</h1>

            <div className={styles.content}>
                {/* Token do servidor */}
                <div className={styles.field}>
                    <label className={styles.label}>token do servidor</label>
                    <input
                        className={styles.input}
                        value={jogoCriado?.token || ''}
                        readOnly
                        placeholder=""
                    />
                    <button
                        className={styles.linkBtn}
                        onClick={handleCopiar}
                        disabled={!jogoCriado}
                    >
                        {copiado ? '✓ Código copiado!' : 'copiar codigo'}
                    </button>
                </div>

            

                {/* Modo de jogo + Dificuldade */}
                <div className={styles.btnRow}>
                    <button className={styles.btnOption} onClick={ciclarModo} disabled={criando}>
                        Modo de jogo: {modoAtual.label}
                    </button>
                    <button className={styles.btnOption} onClick={ciclarDificuldade} disabled={criando}>
                        Dificuldade: {dificuldadeAtual.label}
                    </button>
                </div>

                {/* Descrição do modo */}
                <p className={styles.modoDesc}>{modoAtual.desc}</p>

                {/* Imagem do modo */}
                <div className={styles.imgContainer}>
                    <img
                        src={modoAtual.img}
                        alt={`Modo ${modoAtual.label}`}
                        className={styles.modoImg}
                        draggable={false}
                    />
                </div>

                {/* Aguardando jogador — sempre presente para evitar layout shift */}
                <div className={styles.waitingRow} style={{ visibility: jogoCriado ? 'visible' : 'hidden' }}>
                    <div className={styles.spinner}></div>
                    <span className={styles.waitingText}>Aguardando jogador entrar...</span>
                </div>
            </div>

            {/* Rodapé */}
            <div className={styles.footer}>
                <button className={`${styles.btnFooter} ${styles.btnCancel}`} onClick={handleCancelar}>
                    Cancelar
                </button>
            </div>
        </div>
    );
}
