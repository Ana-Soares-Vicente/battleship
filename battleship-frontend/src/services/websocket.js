import { Client } from '@stomp/stompjs';

// WebSocket nativo direto (sem SockJS) — menor latência
const WS_URL = 'ws://localhost:8080/ws';

let stompClient = null;
const subscriptions = new Map();
let activeStompSubs = new Map();
let pendingCallbacks = [];

export function conectarWebSocket(onConnected) {
    // Já conectado: chama callback imediatamente
    if (stompClient && stompClient.connected) {
        onConnected?.();
        return;
    }

    // Ainda conectando: guarda callback para chamar depois
    if (stompClient) {
        if (onConnected) {
            pendingCallbacks.push(onConnected);
        }
        return;
    }

    // Primeira vez: cria o client
    if (onConnected) {
        pendingCallbacks.push(onConnected);
    }

    stompClient = new Client({
        brokerURL: WS_URL,
        reconnectDelay: 2000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        debug: (str) => {
            console.log('[STOMP]', str);
        },
        onConnect: () => {
            console.log('[WS] Conectado');
            activeStompSubs.clear();
            // Re-inscreve todas as subscriptions pendentes
            subscriptions.forEach((callback, destination) => {
                const sub = stompClient.subscribe(destination, (message) => {
                    const body = JSON.parse(message.body);
                    callback(body);
                });
                activeStompSubs.set(destination, sub);
            });
            // Chama todos os callbacks pendentes
            const callbacks = [...pendingCallbacks];
            pendingCallbacks = [];
            callbacks.forEach(cb => cb());
        },
        onStompError: (frame) => {
            console.error('[WS] Erro STOMP:', frame.headers['message']);
        },
        onWebSocketError: (event) => {
            console.error('[WS] Erro WebSocket:', event);
        },
        onDisconnect: () => {
            console.log('[WS] Desconectado');
        },
    });

    stompClient.activate();
}

export function inscrever(destination, callback) {
    subscriptions.set(destination, callback);

    if (stompClient && stompClient.connected) {
        const sub = stompClient.subscribe(destination, (message) => {
            const body = JSON.parse(message.body);
            callback(body);
        });
        activeStompSubs.set(destination, sub);
        return () => {
            sub.unsubscribe();
            subscriptions.delete(destination);
            activeStompSubs.delete(destination);
        };
    }

    return () => {
        subscriptions.delete(destination);
        const sub = activeStompSubs.get(destination);
        if (sub) {
            sub.unsubscribe();
            activeStompSubs.delete(destination);
        }
    };
}

export function desinscrever(destination) {
    const sub = activeStompSubs.get(destination);
    if (sub) {
        sub.unsubscribe();
        activeStompSubs.delete(destination);
    }
    subscriptions.delete(destination);
}

export function desconectarWebSocket() {
    if (stompClient) {
        stompClient.deactivate();
        stompClient = null;
    }
    subscriptions.clear();
    activeStompSubs.clear();
    pendingCallbacks = [];
}
