const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

function getHeaders() {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

async function request(url, options, mensagemPadrao) {
    const res = await fetch(url, options);
    if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            window.location.href = '/';
            throw new Error('Sessão expirada');
        }
        let msg = mensagemPadrao;
        try {
            const body = await res.json();
            msg = body.message || body.error || mensagemPadrao;
        } catch { /* usa mensagem padrão */ }
        throw new Error(msg);
    }
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) return null;
    return res.json();
}

export async function login(username, password) {
    const data = await request(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    }, 'Usuário ou senha inválidos');
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.username);
    if (data.skin) {
        localStorage.setItem('skinAtual', data.skin);
    } else if (!localStorage.getItem('skinAtual')) {
        localStorage.setItem('skinAtual', '/img/skins/pactw_skin.webp');
    }
    return data;
}

export async function register(nome, email, password) {
    const data = await request(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, password }),
    }, 'Falha ao cadastrar. Email pode já existir.');
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.username || data.nome);
    // Definir skin padrão se o backend não retornar uma
    if (data.skin) {
        localStorage.setItem('skinAtual', data.skin);
    } else if (!localStorage.getItem('skinAtual')) {
        localStorage.setItem('skinAtual', '/img/skins/pactw_skin.webp');
    }
    return data;
}

export async function updateSkin(skin) {
    return request(`${API_URL}/auth/skin`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ skin }),
    }, 'Erro ao atualizar skin');
}

export async function getLobby() {
    return request(`${API_URL}/jogos/lobby`, { headers: getHeaders() }, 'Erro ao buscar lobby');
}

export async function criarJogo(modo) {
    const skin = localStorage.getItem('skinAtual');
    return request(`${API_URL}/jogos`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ skin, modo: modo || 'PADRAO' }),
    }, 'Erro ao criar jogo');
}

export async function entrarJogo(id) {
    const skin = localStorage.getItem('skinAtual');
    return request(`${API_URL}/jogos/${id}/entrar`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ skin }),
    }, 'Erro ao entrar no jogo');
}

export async function entrarJogoPorToken(token) {
    const skin = localStorage.getItem('skinAtual');
    return request(`${API_URL}/jogos/entrar-por-token/${token}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ skin }),
    }, 'Token inválido ou jogo não encontrado');
}

export async function posicionarNavios(id, navios) {
    return request(`${API_URL}/jogos/${id}/posicionar-navios`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ navios }),
    }, 'Erro ao posicionar navios');
}

export async function atirar(id, linha, coluna) {
    return request(`${API_URL}/jogos/${id}/atirar`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ linha, coluna }),
    }, 'Erro ao atirar');
}

export async function getEstadoJogo(id) {
    return request(`${API_URL}/jogos/${id}`, { headers: getHeaders() }, 'Erro ao buscar jogo');
}

export async function getMeusTiros(id) {
    return request(`${API_URL}/jogos/${id}/meus-tiros`, { headers: getHeaders() }, 'Erro ao buscar tiros');
}

export async function getMinhaFrota(id) {
    return request(`${API_URL}/jogos/${id}/minha-frota`, { headers: getHeaders() }, 'Erro ao buscar frota');
}

export async function getTirosRecebidos(id) {
    return request(`${API_URL}/jogos/${id}/tiros-recebidos`, { headers: getHeaders() }, 'Erro ao buscar tiros recebidos');
}

export async function getNaviosAfundadosInimigo(id) {
    return request(`${API_URL}/jogos/${id}/navios-afundados-inimigo`, { headers: getHeaders() }, 'Erro ao buscar navios afundados');
}

export async function atirarExplosao(id, tiros) {
    return request(`${API_URL}/jogos/${id}/atirar-explosao`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ tiros }),
    }, 'Erro ao atirar');
}

export async function getTirosDisponiveis(id) {
    return request(`${API_URL}/jogos/${id}/tiros-disponiveis`, { headers: getHeaders() }, 'Erro ao buscar tiros disponíveis');
}
