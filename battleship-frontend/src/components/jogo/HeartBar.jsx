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
            src = '/img/coracao_cheio.png';
            alt = 'Coração cheio';
        } else if (remaining >= 0.5) {
            src = '/img/coracao_meio.png';
            alt = 'Meio coração';
        } else {
            src = '/img/coracao_vazio.png';
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

    return (
        <div className={styles.heartBar}>
            {hearts}
        </div>
    );
}
