import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { entrarJogoPorToken } from '../../services/api';
import { conectarWebSocket } from '../../services/websocket';
import styles from './EntrarPorToken.module.css';

export default function EntrarPorToken() {
    const [token, setToken] = useState('');
    const [erro, setErro] = useState('');
    const [carregando, setCarregando] = useState(false);
    const navigate = useNavigate();

    async function handleEntrar(e) {
        e.preventDefault();
        const tokenLimpo = token.trim().toUpperCase();
        if (!tokenLimpo) {
            setErro('Digite o codigo da sala.');
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
            setErro(err.message || 'Codigo invalido ou sala nao encontrada.');
        } finally {
            setCarregando(false);
        }
    }

    return (
        <div className={styles.container}>
            <div className={styles.panel}>
                <h1 className={styles.title}>Entrar na Partida</h1>
                <p className={styles.subtitle}>
                    Insira o codigo da sala
                </p>

                <form onSubmit={handleEntrar}>
                    <input
                        className={styles.input}
                        type="text"
                        placeholder="EX: A1B2C3"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        maxLength={10}
                        autoFocus
                    />

                    {erro && <p className={styles.erro}>{erro}</p>}

                    <button
                        className={styles.btn}
                        type="submit"
                        disabled={carregando || !token.trim()}
                    >
                        {carregando ? 'Conectando...' : 'Entrar no Mundo'}
                    </button>
                </form>

                <button
                    className={`${styles.btn} ${styles.btnBack}`}
                    onClick={() => navigate('/lobby')}
                >
                    Voltar
                </button>
            </div>
        </div>
    );
}
