# Batalha Naval — Fog of War

Jogo de Batalha Naval multiplayer com fog of war. Cada jogador só enxerga seu próprio tabuleiro e o resultado dos tiros disparados contra o adversário.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Java 21, Spring Boot 4.1 |
| Segurança | Spring Security + JWT (jjwt) |
| Persistência | PostgreSQL + Spring Data JPA |
| Migrations | Flyway |
| Comunicação tempo real | WebSocket (STOMP over SockJS) |
| Build | Maven |
| Testes | JUnit 5 + Mockito + AssertJ |

## Arquitetura

```
┌─────────────┐      REST/WS       ┌─────────────────────────────┐
│   Cliente   │ ◄─────────────────► │      Spring Boot API        │
└─────────────┘                     │                             │
                                    │  ┌─────────────────────┐    │
                                    │  │  GameService         │    │
                                    │  │  (servidor           │    │
                                    │  │   autoritativo)      │    │
                                    │  └─────────────────────┘    │
                                    │             │               │
                                    │  ┌──────────▼──────────┐    │
                                    │  │   PostgreSQL         │    │
                                    │  └─────────────────────┘    │
                                    └─────────────────────────────┘
```

### Pacotes

- `auth` — Registro, login e geração de JWT
- `game` — Core do domínio: tabuleiro, navios, tiros, regras
- `lobby` — Listagem de partidas disponíveis
- `user` — Entidade de usuário
- `websocket` — Handlers STOMP para comunicação em tempo real
- `security` — Configuração do Spring Security
- `config` — Configurações gerais (WebSocket, etc.)
- `exception` — Handler global de erros
- `shared` — Enums, utilitários compartilhados

## Justificativas

### Servidor Autoritativo
Toda a lógica de jogo roda no backend. O cliente nunca recebe o estado do tabuleiro do oponente — apenas o resultado dos seus próprios tiros (MISS/HIT/SUNK). Isso garante o fog of war por design.

### WebSocket + REST
- **REST** para ações discretas (criar jogo, posicionar navios, consultar estado)
- **WebSocket (STOMP)** para notificar o oponente em tempo real quando um tiro é disparado

### PostgreSQL
Persistência relacional com integridade referencial forte. Ideal para o modelo de dados com relações claras (Game → Board → Ship, Game → Shot).

### JWT Stateless
Autenticação sem sessão no servidor, facilitando escalabilidade horizontal e deploy em containers.

## Como Rodar

```bash
# Pré-requisitos: Java 21, Maven, PostgreSQL

# Criar o banco
createdb battleship

# Rodar
./mvnw spring-boot:run
```

## API Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/auth/register` | Cadastro |
| POST | `/api/auth/login` | Login |
| GET | `/api/lobby` | Partidas disponíveis |
| POST | `/api/games` | Criar partida |
| POST | `/api/games/{id}/join` | Entrar em partida |
| POST | `/api/games/{id}/place-ships` | Posicionar frota |
| POST | `/api/games/{id}/shoot` | Disparar tiro |
| GET | `/api/games/{id}` | Estado da partida |
| GET | `/api/games/{id}/my-shots` | Meus tiros |

## WebSocket

- Conectar em `/ws` (SockJS)
- Subscribe: `/topic/game/{gameId}` — receber notificações de tiros
- Send: `/app/game/{gameId}/shoot` — disparar tiro via WS

## Testes

```bash
./mvnw test
```

Cobertura de testes nas regras de domínio:
- Posicionamento de navios (limites, sobreposição, frota completa)
- Disparos (acerto, erro, afundamento)
- Turnos alternados
- Condição de vitória
- Fog of war (cliente nunca recebe board do oponente)
