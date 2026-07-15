import { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { register } from '../../services/api';
import { useTranslation } from '../../i18n/useTranslation';
import styles from './Register.module.css';

export default function Register() {
    const [nome, setNome] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [erro, setErro] = useState('');
    const [carregando, setCarregando] = useState(false);
    const navigate = useNavigate();
    const { t } = useTranslation();

    const token = localStorage.getItem('token');
    if (token) {
        return <Navigate to="/lobby" replace />;
    }

    async function handleRegister(e) {
        e.preventDefault();
        if (!nome.trim() || !email.trim() || !password.trim()) {
            setErro(t('register.fillAll'));
            return;
        }
        setErro('');
        setCarregando(true);
        try {
            await register(nome.trim(), email.trim(), password);
            navigate('/lobby');
        } catch (err) {
            setErro(err.message || 'Erro ao cadastrar');
        } finally {
            setCarregando(false);
        }
    }

    return (
        <div className={styles.container}>
        
            <div className={styles.card}>
                            <div className={styles.cardHeader}>
                                <span className={styles.microsoftIcon}><img
                            src="/img/ui/bloco_logo.png"
                            alt="Minecraft"
                            className={styles.logo}
                        /></span>
                                <span className={styles.microsoftText}>Minecraft</span>
                            </div>

                <h1 className={styles.title}>{t('register.title')}</h1>

                <form className={styles.form} onSubmit={handleRegister}>
                    {erro && <p className={styles.erro}>{erro}</p>}

                    <input
                        className={styles.input}
                        id="nome"
                        value={nome}
                        onChange={e => setNome(e.target.value)}
                        placeholder={t('register.placeholder.name')}
                        autoComplete="name"
                        disabled={carregando}
                        required
                    />

                    <input
                        className={styles.input}
                        id="email"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder={t('register.placeholder.email')}
                        autoComplete="email"
                        disabled={carregando}
                        required
                    />

                    <input
                        className={styles.input}
                        id="password"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder={t('register.placeholder.password')}
                        autoComplete="new-password"
                        disabled={carregando}
                        required
                    />

                    <p className={styles.noAccount}>
                        {t('register.alreadyHave')} <Link to="/" className={styles.createLink}>{t('register.signIn')}</Link>
                    </p>

                    <div className={styles.buttons}>
                        <Link to="/" className={styles.btnBack}>
                            {t('register.back')}
                        </Link>
                        <button type="submit" className={styles.btnNext} disabled={carregando}>
                            {carregando ? t('register.loading') : t('register.next')}
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
