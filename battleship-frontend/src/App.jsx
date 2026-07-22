import { useEffect } from 'react';
import Login from './components/login/Login';
import Register from './components/register/Register';
import Lobby from './components/lobby/Lobby';
import CriarPartida from './components/lobby/CriarPartida';
import EntrarPartida from './components/lobby/EntrarPartida';
import Options from './components/lobby/Options';
import Skins from './components/lobby/Skins';
import Jogo from './components/jogo/Jogo';
import PrivateRoute from './components/PrivateRoute';
import audioManager from './services/audioManager';
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom';
import './index.css';

// Wrapper para forçar remontagem do Jogo ao mudar de partida (revanche)
function JogoWrapper() {
    const { id } = useParams();
    return <Jogo key={id} />;
}

function App() {
    useEffect(() => {
        // Inicializar música de fundo (com fade in)
        audioManager.initBackgroundMusic();
    }, []);

    return (
        <Router>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/lobby" element={<PrivateRoute><Lobby /></PrivateRoute>} />
                <Route path="/criar-partida" element={<PrivateRoute><CriarPartida /></PrivateRoute>} />
                <Route path="/entrar-partida" element={<PrivateRoute><EntrarPartida /></PrivateRoute>} />
                <Route path="/entrar-token" element={<PrivateRoute><EntrarPartida /></PrivateRoute>} />
                <Route path="/options" element={<PrivateRoute><Options /></PrivateRoute>} />
                <Route path="/skins" element={<PrivateRoute><Skins /></PrivateRoute>} />
                <Route path="/jogo/:id" element={<PrivateRoute><JogoWrapper /></PrivateRoute>} />
            </Routes>
        </Router>
    );
}

export default App;
