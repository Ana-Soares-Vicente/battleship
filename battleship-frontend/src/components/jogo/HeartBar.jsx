import styles from './HeartBar.module.css';

/**
 * HeartBar — Barra de vida estilo Minecraft
 *
 * Props:
 * @param {number} maxHp - Vida máxima (número total de corações)
 * @param {number} currentHp - Vida atual (suporta meio ponto: 2.5 = 2 cheios + 1 meio)
 */
export default function HeartBar({ maxHp, currentHp }) {
    const hearts = [];

    for (let i = 0; i < maxHp; i++) {
        const remaining = currentHp - i;

        let src;
        let alt;

        if (remaining >= 1) {
            src = '/img/coracoes/coracao_cheio.png';
            alt = 'Coração cheio';
        } else if (remaining >= 0.5) {
            src = '/img/coracoes/coracao_meio.png';
            alt = 'Meio coração';
        } else {
            src = '/img/coracoes/coracao_vazio.png';
            alt = 'Coração vazio';
        }

        hearts.push(
            <img
                key={i}
                src={src}
                alt={alt}
                className={styles.heart}
                draggable={false}
            />
        );
    }

    // Layout: 5→3+2, 4→2+2, 3→3, 2→2
    let perRow;
    if (maxHp === 5) perRow = 3;
    else if (maxHp === 4) perRow = 2;
    else perRow = maxHp;

    const rows = [];
    for (let i = 0; i < hearts.length; i += perRow) {
        rows.push(
            <div key={i} className={styles.heartRow}>
                {hearts.slice(i, i + perRow)}
            </div>
        );
    }

    return (
        <div className={styles.heartBar}>
            {rows}
        </div>
    );
}
