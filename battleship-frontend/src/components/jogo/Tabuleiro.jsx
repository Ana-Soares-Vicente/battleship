import { useRef, useState, useEffect, useCallback } from 'react';
import styles from './Tabuleiro.module.css';

// ========================= //
// ICONES                    //
// ========================= //

function IconeRespingo() {
    return (
        <img src="/img/tabuleiro/balde_agua.png" alt="Água" className={styles.iconeRespingo} draggable={false} />
    );
}

function IconeRespingoLava() {
    return (
        <img src="/img/tabuleiro/balde_lava.png" alt="Lava" className={styles.iconeRespingo} draggable={false} />
    );
}

function IconeTntPequena() {
    return (
        <div className={styles.tntContainer}>
            <img src="/img/tabuleiro/tnt-quadrado.png" alt="Acerto" className={styles.iconeTntPequena} />
        </div>
    );
}

function IconePoBlaze() {
    return (
        <div className={styles.tntContainer}>
            <img src="/img/tabuleiro/pó_blaze.png" alt="Acerto" className={styles.iconeTntPequena} />
        </div>
    );
}

// Marcador de navio destruído (TNT queimada + glow)
function MarcadorDestruido() {
    return (
        <div className={styles.marcadorContainer}>
            <img src="/img/tabuleiro/tnt_pequena.png" alt="Destruído" className={styles.tntDestruida} />
        </div>
    );
}

// Explosão ao afundar (aparece uma vez via animação CSS)
function ExplosaoAfundou() {
    return (
        <div className={styles.explosaoAfundou}>
            <div className={`${styles.expPart} ${styles.ep1}`} />
            <div className={`${styles.expPart} ${styles.ep2}`} />
            <div className={`${styles.expPart} ${styles.ep3}`} />
            <div className={`${styles.expPart} ${styles.ep4}`} />
            <div className={`${styles.expPart} ${styles.ep5}`} />
            <div className={`${styles.expPart} ${styles.ep6}`} />
            <div className={`${styles.expFumaca} ${styles.ef1}`} />
            <div className={`${styles.expFumaca} ${styles.ef2}`} />
            <div className={`${styles.expFumaca} ${styles.ef3}`} />
        </div>
    );
}

// Mapeamento tamanho → sprite
const SPRITE_POR_TAMANHO = {
    2: '/img/barcos/barquin_2.png',
    3: '/img/barcos/barquin_3.png',
    4: '/img/barcos/barquin_4.png',
    5: '/img/barcos/barquin_5.png',
};

const COLUNAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

export default function Tabuleiro({
    tiros = [],
    naviosAfundados = [],
    onCelulaClick,
    desabilitado,
    modo = 'ataque',
    meusNavios = [],
    alvosExplosao = [],
    modoJogo = 'PADRAO',
}) {
    // Track quais células acabaram de afundar (para mostrar explosão uma vez)
    const [celulasRecentementeAfundadas, setCelulasRecentementeAfundadas] = useState(new Set());
    const prevAfundadosRef = useRef(0);

    useEffect(() => {
        const currentCount = naviosAfundados.length;
        if (currentCount > prevAfundadosRef.current) {
            // Novo navio afundou — marcar células para explosão
            const novasCelulas = new Set();
            for (let i = prevAfundadosRef.current; i < currentCount; i++) {
                const navio = naviosAfundados[i];
                const { tamanho, linhaInicial, colunaInicial, direcao } = navio;
                for (let j = 0; j < tamanho; j++) {
                    const l = direcao === 'VERTICAL' ? linhaInicial + j : linhaInicial;
                    const c = direcao === 'HORIZONTAL' ? colunaInicial + j : colunaInicial;
                    novasCelulas.add(`${l},${c}`);
                }
            }
            setCelulasRecentementeAfundadas(novasCelulas);

            // Limpar após animação (800ms)
            const timeout = setTimeout(() => {
                setCelulasRecentementeAfundadas(new Set());
            }, 800);

            prevAfundadosRef.current = currentCount;
            return () => clearTimeout(timeout);
        }
        prevAfundadosRef.current = currentCount;
    }, [naviosAfundados]);

    // ========================= //
    // LOGICA                    //
    // ========================= //

    function buildCelulasAfundadas() {
        const celulas = new Set();
        for (const navio of naviosAfundados) {
            const { tamanho, linhaInicial, colunaInicial, direcao } = navio;
            for (let i = 0; i < tamanho; i++) {
                const l = direcao === 'VERTICAL' ? linhaInicial + i : linhaInicial;
                const c = direcao === 'HORIZONTAL' ? colunaInicial + i : colunaInicial;
                celulas.add(`${l},${c}`);
            }
        }
        return celulas;
    }

    const celulasDeNavioAfundado = buildCelulasAfundadas();

    function getTiro(linha, coluna) {
        return tiros.find(t => t.linha === linha && t.coluna === coluna) || null;
    }

    function ehNavioAfundado(linha, coluna) {
        return celulasDeNavioAfundado.has(`${linha},${coluna}`);
    }

    function pertenceAMeuNavio(linha, coluna) {
        for (const navio of meusNavios) {
            const { tamanho, linhaInicial, colunaInicial, direcao } = navio;
            for (let i = 0; i < tamanho; i++) {
                const l = direcao === 'VERTICAL' ? linhaInicial + i : linhaInicial;
                const c = direcao === 'HORIZONTAL' ? colunaInicial + i : colunaInicial;
                if (l === linha && c === coluna) return true;
            }
        }
        return false;
    }

    // Retorna o navio que começa nesta célula (para renderizar sprite)
    function getNavioIniciandoEm(linha, coluna) {
        for (const navio of meusNavios) {
            if (navio.linhaInicial === linha && navio.colunaInicial === coluna) {
                return navio;
            }
        }
        return null;
    }

    function ehRecenteAfundado(linha, coluna) {
        return celulasRecentementeAfundadas.has(`${linha},${coluna}`);
    }

    function ehAlvoExplosao(linha, coluna) {
        return alvosExplosao.some(a => a.linha === linha && a.coluna === coluna);
    }

    // ========================= //
    // MODO ATAQUE               //
    // ========================= //

    function getCelulaClassAtaque(linha, coluna) {
        const tiro = getTiro(linha, coluna);
        if (tiro) {
            if (tiro.resultado === 'PENDENTE') return styles.celulaPendente;
            if (ehNavioAfundado(linha, coluna)) return styles.celulaAfundou;
            if (tiro.resultado === 'AFUNDOU') return styles.celulaAfundou;
            if (tiro.resultado === 'ACERTO') return modoJogo === 'EXPLOSAO' ? styles.celulaAcertoExplosao : styles.celulaAcerto;
            if (tiro.resultado === 'AGUA') return modoJogo === 'EXPLOSAO' ? styles.celulaAguaExplosao : styles.celulaAgua;
        }
        if (ehAlvoExplosao(linha, coluna)) return styles.celulaAlvo;
        if (desabilitado) return styles.celulaDesabilitada;
        return styles.celulaLivre;
    }

    function getConteudoAtaque(linha, coluna) {
        const tiro = getTiro(linha, coluna);
        if (!tiro && ehAlvoExplosao(linha, coluna)) {
            return <img src="/img/tabuleiro/alvo.png" alt="Alvo" className={styles.miraAlvo} draggable={false} />;
        }
        if (!tiro) return null;

        if (ehNavioAfundado(linha, coluna) || tiro.resultado === 'AFUNDOU') {
            // Mostrar sprite do navio transparente na primeira célula
            const navioAfundado = naviosAfundados.find(n => n.linhaInicial === linha && n.colunaInicial === coluna);
            if (navioAfundado) {
                const spriteMap = { 2: '/img/barcos/barquin_2.png', 3: '/img/barcos/barquin_3.png', 4: '/img/barcos/barquin_4.png', 5: '/img/barcos/barquin_5.png' };
                const sprite = spriteMap[navioAfundado.tamanho];
                const isVertical = navioAfundado.direcao === 'VERTICAL';
                return (
                    <>
                        {ehRecenteAfundado(linha, coluna) && <ExplosaoAfundou />}
                        <div
                            className={`${styles.spriteContainer} ${isVertical ? styles.spriteContainerVertical : ''}`}
                            style={{ '--tamanho-navio': navioAfundado.tamanho }}
                        >
                            <img
                                src={sprite}
                                alt={`Navio ${navioAfundado.tamanho}`}
                                className={`${styles.spriteImg} ${isVertical ? styles.spriteImgVertical : ''} ${styles.spriteAfundadoAtaque}`}
                                draggable={false}
                            />
                        </div>
                    </>
                );
            }
            // Células do meio/fim do navio afundado — não renderizar nada extra
            return ehRecenteAfundado(linha, coluna) ? <ExplosaoAfundou /> : null;
        }
        if (tiro.resultado === 'ACERTO') return modoJogo === 'EXPLOSAO' ? <IconePoBlaze /> : <IconeTntPequena />;
        if (tiro.resultado === 'AGUA') return null;
        return null;
    }

    // ========================= //
    // MODO DEFESA               //
    // ========================= //

    function getCelulaClassDefesa(linha, coluna) {
        const tiro = getTiro(linha, coluna);
        const temNavio = pertenceAMeuNavio(linha, coluna);
        if (tiro && temNavio) {
            if (ehNavioAfundado(linha, coluna)) return styles.celulaMeuNavioAfundado;
            return styles.celulaMeuNavioAtingido;
        }
        if (tiro && !temNavio) return styles.celulaTiroRecebidoAgua;
        if (temNavio) return styles.celulaMeuNavio;
        return styles.celulaMarDefesa;
    }

    function getConteudoDefesa(linha, coluna) {
        const tiro = getTiro(linha, coluna);
        const temNavio = pertenceAMeuNavio(linha, coluna);
        // Barco atingido ou afundado: sem ícones — apenas overlay de cor via CSS
        if (tiro && temNavio) {
            return null;
        }
        // Tiro na água: sem ícone (apenas fundo mais escuro via CSS)
        if (tiro && !temNavio) return null;
        return null;
    }

    // Renderiza o sprite do barco na primeira célula (modo defesa)
    function getSpriteDefesa(linha, coluna) {
        if (modo !== 'defesa') return null;
        const navio = getNavioIniciandoEm(linha, coluna);
        if (!navio) return null;

        const sprite = SPRITE_POR_TAMANHO[navio.tamanho];
        if (!sprite) return null;

        const isVertical = navio.direcao === 'VERTICAL';
        const isAfundado = ehNavioAfundado(linha, coluna);

        return (
            <div
                className={`${styles.spriteContainer} ${isVertical ? styles.spriteContainerVertical : ''}`}
                style={{ '--tamanho-navio': navio.tamanho }}
            >
                <img
                    src={sprite}
                    alt={`Barco ${navio.tamanho}`}
                    className={`${styles.spriteImg} ${isVertical ? styles.spriteImgVertical : ''} ${isAfundado ? styles.spriteAfundado : ''}`}
                    draggable={false}
                />
            </div>
        );
    }

    // ========================= //
    // DISPATCH                  //
    // ========================= //

    function getCelulaClass(linha, coluna) {
        if (modo === 'defesa') return getCelulaClassDefesa(linha, coluna);
        return getCelulaClassAtaque(linha, coluna);
    }

    function getConteudo(linha, coluna) {
        if (modo === 'defesa') return getConteudoDefesa(linha, coluna);
        return getConteudoAtaque(linha, coluna);
    }

    function handleClick(linha, coluna) {
        if (desabilitado || modo === 'defesa') return;
        // No modo explosão, permitir clicar em alvos já selecionados (para remover)
        if (alvosExplosao.length > 0 && ehAlvoExplosao(linha, coluna)) {
            if (onCelulaClick) onCelulaClick(linha, coluna);
            return;
        }
        if (getTiro(linha, coluna)) return;
        if (onCelulaClick) onCelulaClick(linha, coluna);
    }

    function ehUltimoTiro(linha, coluna) {
        if (!tiros.length) return false;
        const ultimo = tiros[tiros.length - 1];
        return ultimo.linha === linha && ultimo.coluna === coluna;
    }

    // ========================= //
    // RENDER                    //
    // ========================= //

    return (
        <div className={styles.tabuleiroContainer}>
            <table
                className={`${styles.tabuleiro} ${modo === 'defesa' ? styles.tabuleiroDefesa : styles.tabuleiroAtaque} ${modoJogo === 'EXPLOSAO' ? styles.modoExplosao : ''}`}
            >
                <thead>
                    <tr>
                        <th className={styles.headerCell}></th>
                        {COLUNAS.map((letra, i) => (
                            <th key={i} className={styles.headerCell}>{letra}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: 10 }, (_, linha) => (
                        <tr key={linha}>
                            <td className={styles.rowHeader}>{linha + 1}</td>
                            {Array.from({ length: 10 }, (_, coluna) => (
                                <td
                                    key={coluna}
                                    className={`
                                        ${styles.celula}
                                        ${getCelulaClass(linha, coluna)}
                                        ${ehUltimoTiro(linha, coluna) ? styles.ultimoTiro : ''}
                                    `}
                                    onClick={() => handleClick(linha, coluna)}
                                >
                                    {getSpriteDefesa(linha, coluna)}
                                    {getConteudo(linha, coluna)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
