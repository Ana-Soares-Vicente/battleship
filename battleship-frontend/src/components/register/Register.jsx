import { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { register } from '../../services/api';
import styles from './Register.module.css';

export default function Register() {
    const [nome, setNome] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [erro, setErro] = useState('');
    const [carregando, setCarregando] = useState(false);
    const navigate = useNavigate();

    const token = localStorage.getItem('token');
    if (token) {
        return <Navigate to="/lobby" replace />;
    }

    async function handleRegister(e) {
        e.preventDefault();
        if (!nome.trim() || !email.trim() || !password.trim()) {
            setErro('Preencha todos os campos');
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
                            src="/img/bloco_logo.png"
                            alt="Minecraft"
                            className={styles.logo}
                        /></span>
                                <span className={styles.microsoftText}>Minecraft</span>
                            </div>

                <h1 className={styles.title}>Create account</h1>

                <form className={styles.form} onSubmit={handleRegister}>
                    {erro && <p className={styles.erro}>{erro}</p>}

                    <input
                        className={styles.input}
                        id="nome"
                        value={nome}
                        onChange={e => setNome(e.target.value)}
                        placeholder="Name"
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
                        placeholder="Email"
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
                        placeholder="Password"
                        autoComplete="new-password"
                        disabled={carregando}
                        required
                    />

                    <p className={styles.noAccount}>
                        Already have an account? <Link to="/" className={styles.createLink}>Sign in!</Link>
                    </p>

                    <div className={styles.buttons}>
                        <Link to="/" className={styles.btnBack}>
                            Back
                        </Link>
                        <button type="submit" className={styles.btnNext} disabled={carregando}>
                            {carregando ? 'Loading...' : 'Next'}
                        </button>
                    </div>
                </form>
            </div>

            <div className={styles.signInOptions}>
                <span className={styles.keyIcon}>🔑</span>
                <span>Sign-in options</span>
            </div>
        </div>
    );
}
