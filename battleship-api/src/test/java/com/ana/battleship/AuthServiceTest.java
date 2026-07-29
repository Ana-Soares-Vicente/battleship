package com.ana.battleship;

import com.ana.battleship.model.Usuario;
import com.ana.battleship.repository.UsuarioRepository;
import com.ana.battleship.service.AuthService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UsuarioRepository usuarioRepo;

    private PasswordEncoder passwordEncoder;
    private AuthService authService;

    private static final String SECRET = "test-secret-key-at-least-32-characters-long";

    @BeforeEach
    void setUp() {
        passwordEncoder = new BCryptPasswordEncoder();
        authService = new AuthService(usuarioRepo, passwordEncoder, SECRET);
    }

    @Nested
    @DisplayName("Registro")
    class Registro {

        @Test
        @DisplayName("deve registrar usuário com dados válidos")
        void registrarComSucesso() {
            when(usuarioRepo.existsByUsername("jogador1")).thenReturn(false);
            when(usuarioRepo.existsByEmail("jogador1@gmail.com")).thenReturn(false);
            when(usuarioRepo.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));

            Map<String, String> result = authService.registrar("jogador1", "jogador1@gmail.com", "senha@123");

            assertThat(result).containsKey("token");
            assertThat(result.get("username")).isEqualTo("jogador1");

            ArgumentCaptor<Usuario> captor = ArgumentCaptor.forClass(Usuario.class);
            verify(usuarioRepo).save(captor.capture());
            Usuario salvo = captor.getValue();
            assertThat(salvo.getUsername()).isEqualTo("jogador1");
            assertThat(salvo.getEmail()).isEqualTo("jogador1@gmail.com");
            assertThat(passwordEncoder.matches("senha@123", salvo.getSenha())).isTrue();
        }

        @Test
        @DisplayName("deve rejeitar username com menos de 4 caracteres")
        void rejeitarUsernameCurto() {
            assertThatThrownBy(() -> authService.registrar("abc", "abc@gmail.com", "senha@123"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("mais de 3 caracteres");
        }

        @Test
        @DisplayName("deve rejeitar username null")
        void rejeitarUsernameNull() {
            assertThatThrownBy(() -> authService.registrar(null, "test@gmail.com", "senha@123"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("mais de 3 caracteres");
        }

        @Test
        @DisplayName("deve rejeitar senha sem caractere especial")
        void rejeitarSenhaSemEspecial() {
            assertThatThrownBy(() -> authService.registrar("jogador1", "jogador1@gmail.com", "senha123"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("caractere especial");
        }

        @Test
        @DisplayName("deve rejeitar senha com menos de 4 caracteres")
        void rejeitarSenhaCurta() {
            assertThatThrownBy(() -> authService.registrar("jogador1", "jogador1@gmail.com", "a@1"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("pelo menos 4 caracteres");
        }

        @Test
        @DisplayName("deve rejeitar username duplicado")
        void rejeitarUsernameDuplicado() {
            when(usuarioRepo.existsByUsername("jogador1")).thenReturn(true);

            assertThatThrownBy(() -> authService.registrar("jogador1", "jogador1@gmail.com", "senha@123"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Nome já existe");
        }

        @Test
        @DisplayName("deve rejeitar email duplicado")
        void rejeitarEmailDuplicado() {
            when(usuarioRepo.existsByUsername("jogador1")).thenReturn(false);
            when(usuarioRepo.existsByEmail("jogador1@gmail.com")).thenReturn(true);

            assertThatThrownBy(() -> authService.registrar("jogador1", "jogador1@gmail.com", "senha@123"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Email já está em uso");
        }

        @Test
        @DisplayName("deve rejeitar email com formato inválido")
        void rejeitarEmailInvalido() {
            when(usuarioRepo.existsByUsername("jogador1")).thenReturn(false);
            when(usuarioRepo.existsByEmail("emailinvalido")).thenReturn(false);

            assertThatThrownBy(() -> authService.registrar("jogador1", "emailinvalido", "senha@123"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Formato de email inválido");
        }

        @Test
        @DisplayName("deve rejeitar email com domínio não permitido")
        void rejeitarDominioInvalido() {
            when(usuarioRepo.existsByUsername("jogador1")).thenReturn(false);
            when(usuarioRepo.existsByEmail("jogador1@empresa.corp")).thenReturn(false);

            assertThatThrownBy(() -> authService.registrar("jogador1", "jogador1@empresa.corp", "senha@123"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("provedor válido");
        }

        @Test
        @DisplayName("deve aceitar domínios válidos (hotmail, outlook, yahoo)")
        void aceitarDominiosValidos() {
            when(usuarioRepo.existsByUsername(anyString())).thenReturn(false);
            when(usuarioRepo.existsByEmail(anyString())).thenReturn(false);
            when(usuarioRepo.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));

            assertThatNoException().isThrownBy(() -> authService.registrar("user1234", "user@hotmail.com", "senha@123"));
            assertThatNoException().isThrownBy(() -> authService.registrar("user5678", "user@outlook.com", "senha@123"));
            assertThatNoException().isThrownBy(() -> authService.registrar("user9012", "user@yahoo.com", "senha@123"));
        }
    }

    @Nested
    @DisplayName("Login")
    class Login {

        @Test
        @DisplayName("deve fazer login com username válido")
        void loginComUsername() {
            Usuario usuario = Usuario.builder()
                    .id(1L)
                    .username("jogador1")
                    .email("jogador1@gmail.com")
                    .senha(passwordEncoder.encode("senha@123"))
                    .skin("pirata")
                    .build();

            when(usuarioRepo.findByEmail("jogador1")).thenReturn(Optional.empty());
            when(usuarioRepo.findByUsername("jogador1")).thenReturn(Optional.of(usuario));

            Map<String, String> result = authService.login("jogador1", "senha@123");

            assertThat(result.get("token")).isNotBlank();
            assertThat(result.get("username")).isEqualTo("jogador1");
            assertThat(result.get("skin")).isEqualTo("pirata");
        }

        @Test
        @DisplayName("deve fazer login com email válido")
        void loginComEmail() {
            Usuario usuario = Usuario.builder()
                    .id(1L)
                    .username("jogador1")
                    .email("jogador1@gmail.com")
                    .senha(passwordEncoder.encode("senha@123"))
                    .build();

            when(usuarioRepo.findByEmail("jogador1@gmail.com")).thenReturn(Optional.of(usuario));

            Map<String, String> result = authService.login("jogador1@gmail.com", "senha@123");

            assertThat(result.get("username")).isEqualTo("jogador1");
        }

        @Test
        @DisplayName("deve rejeitar credenciais inválidas - usuário não existe")
        void rejeitarUsuarioInexistente() {
            when(usuarioRepo.findByEmail("naoexiste")).thenReturn(Optional.empty());
            when(usuarioRepo.findByUsername("naoexiste")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> authService.login("naoexiste", "senha@123"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Credenciais inválidas");
        }

        @Test
        @DisplayName("deve rejeitar credenciais inválidas - senha errada")
        void rejeitarSenhaErrada() {
            Usuario usuario = Usuario.builder()
                    .id(1L)
                    .username("jogador1")
                    .senha(passwordEncoder.encode("senha@123"))
                    .build();

            when(usuarioRepo.findByEmail("jogador1")).thenReturn(Optional.empty());
            when(usuarioRepo.findByUsername("jogador1")).thenReturn(Optional.of(usuario));

            assertThatThrownBy(() -> authService.login("jogador1", "senhaerrada"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Credenciais inválidas");
        }
    }

    @Nested
    @DisplayName("Token JWT")
    class TokenJWT {

        @Test
        @DisplayName("deve gerar token válido")
        void gerarTokenValido() {
            String token = authService.gerarToken("jogador1");

            assertThat(token).isNotBlank();
            assertThat(authService.validarToken(token)).isEqualTo("jogador1");
        }

        @Test
        @DisplayName("deve retornar null para token inválido")
        void tokenInvalido() {
            assertThat(authService.validarToken("token.invalido.aqui")).isNull();
        }

        @Test
        @DisplayName("deve retornar null para token vazio")
        void tokenVazio() {
            assertThat(authService.validarToken("")).isNull();
        }
    }

    @Nested
    @DisplayName("Atualizar Skin")
    class AtualizarSkin {

        @Test
        @DisplayName("deve atualizar skin do usuário")
        void atualizarSkinComSucesso() {
            Usuario usuario = Usuario.builder().id(1L).username("jogador1").email("j@gmail.com").senha("x").build();
            when(usuarioRepo.findByUsername("jogador1")).thenReturn(Optional.of(usuario));
            when(usuarioRepo.save(any(Usuario.class))).thenAnswer(inv -> inv.getArgument(0));

            Map<String, String> result = authService.atualizarSkin("jogador1", "pirata");

            assertThat(result.get("skin")).isEqualTo("pirata");
            verify(usuarioRepo).save(usuario);
            assertThat(usuario.getSkin()).isEqualTo("pirata");
        }

        @Test
        @DisplayName("deve lançar exceção para usuário inexistente")
        void skinUsuarioInexistente() {
            when(usuarioRepo.findByUsername("fantasma")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> authService.atualizarSkin("fantasma", "pirata"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Usuário não encontrado");
        }
    }

    @Nested
    @DisplayName("loadUserByUsername")
    class LoadUser {

        @Test
        @DisplayName("deve carregar UserDetails pelo username")
        void carregarUsuario() {
            Usuario usuario = Usuario.builder().id(1L).username("jogador1").senha("hashed").build();
            when(usuarioRepo.findByUsername("jogador1")).thenReturn(Optional.of(usuario));

            var userDetails = authService.loadUserByUsername("jogador1");

            assertThat(userDetails.getUsername()).isEqualTo("jogador1");
            assertThat(userDetails.getPassword()).isEqualTo("hashed");
        }

        @Test
        @DisplayName("deve lançar UsernameNotFoundException se não encontrar")
        void usuarioNaoEncontrado() {
            when(usuarioRepo.findByUsername("fantasma")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> authService.loadUserByUsername("fantasma"))
                    .isInstanceOf(UsernameNotFoundException.class);
        }
    }
}
