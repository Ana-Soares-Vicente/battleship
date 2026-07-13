import { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { login } from '../../services/api';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './Login.module.css';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [erro, setErro] = useState('');
    const [carregando, setCarregando] = useState(false);
    const navigate = useNavigate();
    const { t } = useTranslation();

    const token = localStorage.getItem('token');
    if (token) {
        return <Navigate to="/lobby" replace />;
    }

    async function handleLogin(e) {
        e.preventDefault();
        if (!username.trim() || !password.trim()) {
            setErro(t('login.fillAll'));
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

    return (
        <div className={styles.container}>
         
            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <span className={styles.microsoftIcon}><img
                src="/img/bloco_logo.png"
                alt="Minecraft"
                className={styles.logo}
            /></span>
                    <span className={styles.microsoftText}>Minecraft</span>
                </div>

                <h1 className={styles.title}> {t('login.title')}</h1>

                <form className={styles.form} onSubmit={handleLogin}>
                    {erro && <p className={styles.erro}>{erro}</p>}

                    <input
                        className={styles.input}
                        id="username"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder={t('login.placeholder.username')}
                        autoComplete="username"
                        disabled={carregando}
                        required
                    />

                    <input
                        className={styles.input}
                        id="password"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder={t('login.placeholder.password')}
                        autoComplete="current-password"
                        disabled={carregando}
                        required
                    />

                    <p className={styles.noAccount}>
                        {t('login.noAccount')} <Link to="/register" className={styles.createLink}>{t('login.createOne')}</Link>
                    </p>

                    <div className={styles.buttons}>
                        <button type="button" className={styles.btnBack} disabled={carregando}>
                            {t('login.back')}
                        </button>
                        <button type="submit" className={styles.btnNext} disabled={carregando}>
                            {carregando ? t('login.loading') : t('login.next')}
                        </button>
                    </div>
                </form>
            </div>

            <div className={styles.signInOptions}>
                <span className={styles.keyIcon}>🔑</span>
                <span>{t('login.signInOptions')}</span>
            </div>
        </div>
    );
}
