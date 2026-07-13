import styles from './FrotaInimiga.module.css';
import HeartBar from './HeartBar';

const FROTA_PADRAO = [
    { tipo: 'PORTA_AVIOES', tamanho: 5, img: '/img/barquin_5.png' },
    { tipo: 'ENCOURACADO', tamanho: 4, img: '/img/barquin_4.png' },
    { tipo: 'CRUZADOR', tamanho: 3, img: '/img/barquin_3.png' },
    { tipo: 'SUBMARINO', tamanho: 3, img: '/img/barquin_3.png' },
    { tipo: 'DESTROYER', tamanho: 2, img: '/img/barquin_2.png' },
];

/**
 * Inventário Naval — HUD estilo Minecraft
 * Sem nomes, só ícone + corações
 */
export default function FrotaInimiga({ naviosAfundados = [], tiros = [], ehInimigo = false, layout = 'horizontal' }) {

    function contarAfundadosPorTamanho() {
        const contagem = {};
        for (const navio of naviosAfundados) {
            const tam = navio.tamanho;
            contagem[tam] = (contagem[tam] || 0) + 1;
        }
        return contagem;
    }

    function contarAcertosPendentes() {
        return tiros.filter(t => t.resultado === 'ACERTO').length;
    }

    const afundadosPorTamanho = contarAfundadosPorTamanho();
    const acertosPendentes = contarAcertosPendentes();

    function buildListaNavios() {
        const contagemUsada = {};
        const naviosComStatus = FROTA_PADRAO.map(navio => {
            const tam = navio.tamanho;
            const jaUsados = contagemUsada[tam] || 0;
            const totalAfundados = afundadosPorTamanho[tam] || 0;
            const afundado = jaUsados < totalAfundados;
            contagemUsada[tam] = jaUsados + 1;
            return { ...navio, afundado };
        });

        let acertosRestantes = acertosPendentes;
        const naviosOrdenados = naviosComStatus
            .map((n, idx) => ({ ...n, originalIdx: idx }))
            .filter(n => !n.afundado)
            .sort((a, b) => a.tamanho - b.tamanho);

        const hitsDistribuidos = {};
        for (const navio of naviosOrdenados) {
            if (acertosRestantes <= 0) break;
            const maxHits = navio.tamanho - 1;
            const hits = Math.min(acertosRestantes, maxHits);
            hitsDistribuidos[navio.originalIdx] = hits;
            acertosRestantes -= hits;
        }

        return naviosComStatus.map((navio, idx) => {
            let currentHp;
            if (navio.afundado) {
                currentHp = 0;
            } else {
                const hits = hitsDistribuidos[idx] || 0;
                currentHp = navio.tamanho - hits;
            }
            return { ...navio, currentHp };
        });
    }

    const navios = buildListaNavios();

    return (
        <div className={`${styles.inventario} ${layout === 'vertical' ? styles.inventarioVertical : ''}`}>
            {navios.map((navio, index) => {
                const oculto = ehInimigo && !navio.afundado;

                return (
                    <div
                        key={index}
                        className={`
                            ${styles.slot}
                            ${navio.afundado ? styles.slotAfundado : ''}
                            ${oculto ? styles.slotOculto : ''}
                        `}
                    >
                        <div className={styles.slotIcone}>
                            {oculto ? (
                                <span className={styles.misterio}>?</span>
                            ) : (
                                <img
                                    src={navio.img}
                                    alt={`Barco ${navio.tamanho}`}
                                    className={styles.barcoImg}
                                    draggable={false}
                                />
                            )}
                            {navio.afundado && <span className={styles.xMark}>✕</span>}
                        </div>
                        <div className={styles.hearts}>
                            {oculto ? (
                                <span className={styles.hpOculto}>???</span>
                            ) : (
                                <HeartBar maxHp={navio.tamanho} currentHp={navio.currentHp} />
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
