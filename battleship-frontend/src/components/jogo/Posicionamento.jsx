import { useState } from 'react';
import { posicionarNavios } from '../../services/api';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './Posicionamento.module.css';

const FROTA = [
    { tipo: 'PORTA_AVIOES', tamanho: 5, nomeKey: 'ships.portaAvioes' },
    { tipo: 'ENCOURACADO', tamanho: 4, nomeKey: 'ships.encouracado' },
    { tipo: 'CRUZADOR', tamanho: 3, nomeKey: 'ships.cruzador' },
    { tipo: 'SUBMARINO', tamanho: 3, nomeKey: 'ships.submarino' },
    { tipo: 'DESTROIER', tamanho: 2, nomeKey: 'ships.destroier' },
];

const SPRITE_POR_TAMANHO = {
    2: '/img/barcos/barquin_2.png',
    3: '/img/barcos/barquin_3.png',
    4: '/img/barcos/barquin_4.png',
    5: '/img/barcos/barquin_5.png',
};

export default function Posicionamento({ jogoId, onPronto, jogador1, jogador2, minhaSkin, skinAdversario, modo }) {
    const [naviosPosicionados, setNaviosPosicionados] = useState([]);
    const [navioSelecionado, setNavioSelecionado] = useState('PORTA_AVIOES');
    const [direcao, setDirecao] = useState('HORIZONTAL');
    const [hover, setHover] = useState(null);
    const [erro, setErro] = useState('');
    const [enviando, setEnviando] = useState(false);
    const { t } = useTranslation();

    // FONTE DE VERDADE: sempre ler a skin do localStorage
    const skinEquipada = localStorage.getItem('skinAtual');
    console.log('[SKINS] Posicionamento - Skin equipada (localStorage):', skinEquipada);
    console.log('[SKINS] Posicionamento - minhaSkin prop:', minhaSkin);
    console.log('[SKINS] Posicionamento - skinAdversario prop:', skinAdversario);
    console.log('[SKINS] Posicionamento - jogador1:', jogador1, '| jogador2:', jogador2);

    const tiposPosicionados = naviosPosicionados.map(n => n.tipo);

    const navioAtual = navioSelecionado
        ? FROTA.find(f => f.tipo === navioSelecionado)
        : null;

    function proximoNavioDisponivel(tiposJaPosicionados) {
        for (const f of FROTA) {
            if (!tiposJaPosicionados.includes(f.tipo)) {
                return f.tipo;
            }
        }
        return null;
    }

    function getCelulasNavio(linhaInicial, colunaInicial, tamanho, dir) {
        const celulas = [];
        for (let i = 0; i < tamanho; i++) {
            const l = dir === 'VERTICAL' ? linhaInicial + i : linhaInicial;
            const c = dir === 'HORIZONTAL' ? colunaInicial + i : colunaInicial;
            celulas.push({ linha: l, coluna: c });
        }
        return celulas;
    }

    function posicaoValida(linha, coluna, tamanho, dir) {
        const celulas = getCelulasNavio(linha, coluna, tamanho, dir);
        if (celulas.some(c => c.linha < 0 || c.linha >= 10 || c.coluna < 0 || c.coluna >= 10)) {
            return false;
        }
        for (const navio of naviosPosicionados) {
            const celulasNavio = getCelulasNavio(navio.linhaInicial, navio.colunaInicial, navio.tamanho, navio.direcao);
            for (const c of celulas) {
                if (celulasNavio.some(cn => cn.linha === c.linha && cn.coluna === c.coluna)) {
                    return false;
                }
            }
        }
        return true;
    }

    function getNavioNaCelula(linha, coluna) {
        for (const navio of naviosPosicionados) {
            const celulas = getCelulasNavio(navio.linhaInicial, navio.colunaInicial, navio.tamanho, navio.direcao);
            if (celulas.some(c => c.linha === linha && c.coluna === coluna)) {
                return navio;
            }
        }
        return null;
    }

    function ehPrimeiraCelula(linha, coluna, navio) {
        return navio.linhaInicial === linha && navio.colunaInicial === coluna;
    }

    function getPreviewCelulas() {
        if (!navioAtual || !hover) return [];
        return getCelulasNavio(hover.linha, hover.coluna, navioAtual.tamanho, direcao);
    }

    function isPreview(linha, coluna) {
        return getPreviewCelulas().some(c => c.linha === linha && c.coluna === coluna);
    }

    function isPreviewValido() {
        if (!navioAtual || !hover) return false;
        return posicaoValida(hover.linha, hover.coluna, navioAtual.tamanho, direcao);
    }

    function isPreviewPrimeira(linha, coluna) {
        if (!navioAtual || !hover) return false;
        return hover.linha === linha && hover.coluna === coluna;
    }

    function handleCelulaClick(linha, coluna) {
        if (!navioAtual) return;
        if (!posicaoValida(linha, coluna, navioAtual.tamanho, direcao)) return;
        const novosPosicionados = [...naviosPosicionados, {
            tipo: navioAtual.tipo,
            tamanho: navioAtual.tamanho,
            linhaInicial: linha,
            colunaInicial: coluna,
            direcao,
        }];
        setNaviosPosicionados(novosPosicionados);
        const tiposJaPosicionados = novosPosicionados.map(n => n.tipo);
        setNavioSelecionado(proximoNavioDisponivel(tiposJaPosicionados));
        setHover(null);
    }

    function handleContextMenu(e) {
        e.preventDefault();
        setDirecao(prev => prev === 'HORIZONTAL' ? 'VERTICAL' : 'HORIZONTAL');
    }

    function handleSelecionarNavio(tipo) {
        if (tiposPosicionados.includes(tipo)) return;
        setNavioSelecionado(prev => prev === tipo ? null : tipo);
    }

    function handleRemoverNavio(e, tipo) {
        e.preventDefault();
        e.stopPropagation();
        setNaviosPosicionados(prev => prev.filter(n => n.tipo !== tipo));
        setNavioSelecionado(tipo);
        setErro('');
    }

    function handleResetar() {
        setNaviosPosicionados([]);
        setNavioSelecionado('PORTA_AVIOES');
        setDirecao('HORIZONTAL');
        setErro('');
    }

    async function handleConfirmar() {
        if (naviosPosicionados.length !== 5) return;
        setErro('');
        setEnviando(true);
        try {
            const payload = naviosPosicionados.map(({ tipo, linhaInicial, colunaInicial, direcao }) => ({
                tipo, linhaInicial, colunaInicial, direcao,
            }));
            await posicionarNavios(jogoId, payload);
            onPronto();
        } catch (err) {
            console.error('Erro ao posicionar:', err);
            setErro(err.message);
        } finally {
            setEnviando(false);
        }
    }

    const previewValido = isPreviewValido();
    const todosPosicionados = naviosPosicionados.length === 5;

    return (
        <div className={styles.container}>
            {/* Background overlay */}
            {modo === 'EXPLOSAO' ? (
                <video className={styles.bgVideo} src="/img/fundos/nether_video_modoexplosao.mp4" autoPlay loop muted playsInline ref={el => { if (el) el.playbackRate = 0.6; }} />
            ) : (
                <video className={styles.bgVideo} src="/img/fundos/fundo_padrao_peixes_mexendo.mp4" autoPlay loop muted playsInline />
            )}

            {/* Header com jogadores e skins */}
            <header className={styles.header}>
                <h1 className={styles.title}>MINECRAFT BATTLESHIP</h1>
                <div className={styles.playersRow}>
                    <div className={styles.playerSlot}>
                        {skinEquipada && <img src={skinEquipada} alt={jogador1} className={styles.playerSkin} />}
                        <span className={styles.playerName}>{(jogador1 || 'Jogador 1').toUpperCase()}</span>
                    </div>
                    <span className={styles.vs}>⚔</span>
                    <div className={styles.playerSlot}>
                        <span className={styles.playerName}>{(jogador2 || 'Jogador 2').toUpperCase()}</span>
                        {skinAdversario && <img src={skinAdversario} alt={jogador2} className={styles.playerSkin} />}
                    </div>
                </div>
                <p className={styles.subtitle}>{t('position.title')}</p>
            </header>

            {/* Progress bar */}
            <div className={styles.progressContainer}>
                <div className={styles.progressBar}>
                    <div
                        className={styles.progressFill}
                        style={{ width: `${(naviosPosicionados.length / 5) * 100}%` }}
                    />
                </div>
                <span className={styles.progressText}>
                    {naviosPosicionados.length}/5
                </span>
            </div>

            {/* Ship info panel */}
            <div className={styles.infoPanel}>
                {navioAtual ? (
                    <>
                        <span className={styles.infoPanelName}>{t(navioAtual.nomeKey)}</span>
                        <span className={styles.infoPanelBlocks}>
                            {Array.from({ length: navioAtual.tamanho }, (_, i) => (
                                <span key={i} className={styles.block} />
                            ))}
                        </span>
                        <span className={styles.infoPanelDir}>
                            {direcao === 'HORIZONTAL' ? t('position.horizontal') : t('position.vertical')}
                        </span>
                    </>
                ) : (
                    <span className={styles.infoPanelReady}>{t('position.allPositioned')}</span>
                )}
            </div>

            {/* Error */}
            {erro && <p className={styles.erro}>{erro}</p>}

            {/* Dica de controles */}
            <p className={styles.dica}>{t('position.controls')}</p>

            {/* Board + Inventário lateral */}
            <div className={styles.boardArea}>
                {/* Board + Buttons column */}
                <div className={styles.boardColumn}>
                    <div className={styles.boardFrame}>
                    <table className={styles.tabuleiro} onContextMenu={handleContextMenu}>
                        <thead>
                            <tr>
                                <th className={styles.headerCell}></th>
                                {['A','B','C','D','E','F','G','H','I','J'].map((letra, i) => (
                                    <th key={i} className={styles.headerCell}>{letra}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from({ length: 10 }, (_, linha) => (
                                <tr key={linha}>
                                    <td className={styles.rowHeader}>{linha + 1}</td>
                                    {Array.from({ length: 10 }, (_, coluna) => {
                                        const navioNaCelula = getNavioNaCelula(linha, coluna);
                                        const preview = isPreview(linha, coluna);

                                        let celulaClass = styles.celulaVazia;
                                        if (navioNaCelula) {
                                            celulaClass = styles.celulaOcupada;
                                        } else if (preview) {
                                            celulaClass = previewValido ? styles.celulaPreviewOk : styles.celulaPreviewErro;
                                        }

                                        let spriteElement = null;
                                        if (navioNaCelula && ehPrimeiraCelula(linha, coluna, navioNaCelula)) {
                                            const sprite = SPRITE_POR_TAMANHO[navioNaCelula.tamanho];
                                            const isVertical = navioNaCelula.direcao === 'VERTICAL';
                                            spriteElement = (
                                                <div
                                                    className={`${styles.spriteContainer} ${isVertical ? styles.spriteContainerVertical : ''}`}
                                                    style={{
                                                        '--tamanho-navio': navioNaCelula.tamanho,
                                                    }}
                                                >
                                                    <img
                                                        src={sprite}
                                                        alt={`Barco ${navioNaCelula.tamanho}`}
                                                        className={`${styles.spriteImg} ${isVertical ? styles.spriteImgVertical : ''}`}
                                                        draggable={false}
                                                    />
                                                </div>
                                            );
                                        }

                                        let previewSprite = null;
                                        if (preview && isPreviewPrimeira(linha, coluna) && navioAtual) {
                                            const sprite = SPRITE_POR_TAMANHO[navioAtual.tamanho];
                                            const isVertical = direcao === 'VERTICAL';
                                            previewSprite = (
                                                <div
                                                    className={`${styles.spriteContainer} ${isVertical ? styles.spriteContainerVertical : ''} ${styles.spritePreview} ${!previewValido ? styles.spriteInvalid : ''}`}
                                                    style={{
                                                        '--tamanho-navio': navioAtual.tamanho,
                                                    }}
                                                >
                                                    <img
                                                        src={sprite}
                                                        alt={`Preview ${navioAtual.tamanho}`}
                                                        className={`${styles.spriteImg} ${isVertical ? styles.spriteImgVertical : ''}`}
                                                        draggable={false}
                                                    />
                                                </div>
                                            );
                                        }

                                        return (
                                            <td
                                                key={coluna}
                                                className={`${styles.celula} ${celulaClass} ${navioAtual ? styles.celulaAtiva : ''}`}
                                                onMouseEnter={() => setHover({ linha, coluna })}
                                                onMouseLeave={() => setHover(null)}
                                                onClick={() => handleCelulaClick(linha, coluna)}
                                                title={`${['A','B','C','D','E','F','G','H','I','J'][coluna]}${linha + 1}`}
                                            >
                                                {spriteElement}
                                                {previewSprite}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Action buttons — inside boardColumn, centered to board */}
                <div className={styles.botoes}>
                    <button
                        className={styles.btnResetar}
                        type="button"
                        onClick={handleResetar}
                        disabled={naviosPosicionados.length === 0 || enviando}
                    >
                        {t('position.reset')}
                    </button>
                    <button
                        className={`${styles.btnConfirmar} ${todosPosicionados ? styles.btnConfirmarPulse : ''}`}
                        type="button"
                        onClick={handleConfirmar}
                        disabled={!todosPosicionados || enviando}
                    >
                        {enviando ? '...' : t('position.confirm')}
                    </button>
                </div>
                </div>

                {/* Inventário lateral */}
                <div className={styles.inventarioLateral}>
                    {FROTA.map((f) => {
                        const posicionado = tiposPosicionados.includes(f.tipo);
                        const selecionado = navioSelecionado === f.tipo;

                        return (
                            <div
                                key={f.tipo}
                                className={`${styles.hotbarSlot} ${selecionado ? styles.hotbarSlotSelected : ''} ${posicionado ? styles.hotbarSlotPositioned : ''}`}
                                onClick={() => handleSelecionarNavio(f.tipo)}
                                onContextMenu={(e) => {
                                    if (posicionado) {
                                        handleRemoverNavio(e, f.tipo);
                                    } else {
                                        e.preventDefault();
                                    }
                                }}
                                title={posicionado ? 'Botão direito para remover' : t(f.nomeKey)}
                            >
                                <img
                                    src={SPRITE_POR_TAMANHO[f.tamanho]}
                                    alt={f.nome}
                                    className={styles.hotbarSprite}
                                    draggable={false}
                                />
                                {posicionado && <div className={styles.hotbarDarken} />}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
