import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { login, register } from '../../services/api';
import styles from './Login.module.css';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [erro, setErro] = useState('');
    const [carregando, setCarregando] = useState(false);
    const navigate = useNavigate();

    const token = localStorage.getItem('token');
    if (token) {
        return <Navigate to="/lobby" replace />;
    }

    async function handleLogin(e) {
        e.preventDefault();
        if (!username.trim() || !password.trim()) {
            setErro('Preencha todos os campos');
            return;
        }
        setErro('');
        setCarregando(true);
        try {
            await login(username.trim(), password);
            navigate('/lobby');
        } catch (err) {
            setErro(err.message || 'Erro ao fazer login');
        } finally {
            setCarregando(false);
        }
    }

    async function handleRegister(e) {
        e.preventDefault();
        if (!username.trim() || !password.trim()) {
            setErro('Preencha todos os campos');
            return;
        }
        setErro('');
        setCarregando(true);
        try {
            await register(username.trim(), password);
            navigate('/lobby');
        } catch (err) {
            setErro(err.message || 'Erro ao cadastrar');
        } finally {
            setCarregando(false);
        }
    }

    return (
        <div className={styles.container}>
            {/* Título no topo */}
            <h1 className={styles.title}>Minecraft Battleship</h1>

            {/* Painel central estilo MC */}
            <div className={styles.panel}>
                <form className={styles.form} onSubmit={handleLogin}>
                    {erro && <p className={styles.erro}>{erro}</p>}

                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="username">Username</label>
                        <input
                            className={styles.input}
                            id="username"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="Player Name..."
                            autoComplete="username"
                            disabled={carregando}
                            required
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="password">Password</label>
                        <input
                            className={styles.input}
                            id="password"
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            autoComplete="current-password"
                            disabled={carregando}
                            required
                        />
                    </div>

                    <button className={styles.btnLogin} type="submit" disabled={carregando}>
                        {carregando ? 'Entrando...' : 'Login'}
                    </button>

                    <div className={styles.divider}>
                        <span className={styles.dividerLine}></span>
                        <span className={styles.dividerText}>OR</span>
                        <span className={styles.dividerLine}></span>
                    </div>

                    <button className={styles.btnRegister} type="button" onClick={handleRegister} disabled={carregando}>
                        {carregando ? 'Criando...' : 'Register'}
                    </button>
                </form>

                <div className={styles.footer}>
                    <span className={styles.footerLink}>Forgot Password?</span>
                </div>
            </div>

            {/* Barra inferior com versão e status */}
            <div className={styles.bottomBar}>
                <span className={styles.version}>V1.18.2 STABLE</span>
                <span className={styles.serverStatus}>
                    <span className={styles.serverDot}></span>
                    SERVER ONLINE
                </span>
            </div>
        </div>
    );
}
