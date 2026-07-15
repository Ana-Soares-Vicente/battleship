package com.ana.battleship.service;

import com.ana.battleship.model.Usuario;
import com.ana.battleship.repository.UsuarioRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Pattern;

@Service
public class AuthService implements UserDetailsService {

    private static final Pattern EMAIL_PATTERN = Pattern.compile(
            "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$"
    );

    private static final Set<String> DOMINIOS_PERMITIDOS = Set.of(
            "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "yahoo.com.br",
            "live.com", "icloud.com", "protonmail.com", "zoho.com",
            "hotmail.com.br", "outlook.com.br", "bol.com.br", "uol.com.br",
            "terra.com.br", "ig.com.br", "globo.com", "msn.com"
    );

    private final UsuarioRepository usuarioRepo;
    private final PasswordEncoder passwordEncoder;
    private final String secret;

    public AuthService(UsuarioRepository usuarioRepo, PasswordEncoder passwordEncoder,
                       @Value("${jwt.secret}") String secret) {
        this.usuarioRepo = usuarioRepo;
        this.passwordEncoder = passwordEncoder;
        this.secret = secret;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        Usuario usuario = usuarioRepo.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException(username));
        return new User(usuario.getUsername(), usuario.getSenha(), List.of());
    }

    public Map<String, String> registrar(String nome, String email, String senha) {
        // Validação de username — mínimo 4 caracteres
        if (nome == null || nome.trim().length() < 4) {
            throw new IllegalArgumentException("O nome de usuário deve ter mais de 3 caracteres");
        }

        // Validação de senha — deve conter pelo menos um caractere especial
        if (senha == null || senha.length() < 4) {
            throw new IllegalArgumentException("A senha deve ter pelo menos 4 caracteres");
        }
        if (!senha.matches(".*[^A-Za-z0-9].*")) {
            throw new IllegalArgumentException("A senha deve conter pelo menos um caractere especial (ex: @ . ! # $)");
        }

        if (usuarioRepo.existsByUsername(nome))
            throw new IllegalArgumentException("Nome já existe");
        if (usuarioRepo.existsByEmail(email))
            throw new IllegalArgumentException("Email já está em uso");

        // Validação de formato de email
        if (email == null || !EMAIL_PATTERN.matcher(email).matches()) {
            throw new IllegalArgumentException("Formato de email inválido");
        }

        // Validação de domínio — apenas provedores conhecidos
        String dominio = email.substring(email.indexOf('@') + 1).toLowerCase();
        if (!DOMINIOS_PERMITIDOS.contains(dominio)) {
            throw new IllegalArgumentException("Use um email de provedor válido (Gmail, Hotmail, Outlook, Yahoo, etc.)");
        }

        Usuario usuario = Usuario.builder()
                .username(nome)
                .email(email)
                .senha(passwordEncoder.encode(senha))
                .build();
        usuarioRepo.save(usuario);
        Map<String, String> result = new HashMap<>();
        result.put("token", gerarToken(nome));
        result.put("username", nome);
        result.put("skin", null);
        return result;
    }

    public Map<String, String> login(String identificador, String senha) {
        Optional<Usuario> optUsuario = usuarioRepo.findByEmail(identificador);
        if (optUsuario.isEmpty()) {
            optUsuario = usuarioRepo.findByUsername(identificador);
        }
        Usuario usuario = optUsuario
                .orElseThrow(() -> new IllegalArgumentException("Credenciais inválidas"));
        if (!passwordEncoder.matches(senha, usuario.getSenha()))
            throw new IllegalArgumentException("Credenciais inválidas");
        Map<String, String> result = new HashMap<>();
        result.put("token", gerarToken(usuario.getUsername()));
        result.put("username", usuario.getUsername());
        result.put("skin", usuario.getSkin());
        return result;
    }

    public Map<String, String> atualizarSkin(String username, String skin) {
        Usuario usuario = usuarioRepo.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado"));
        usuario.setSkin(skin);
        usuarioRepo.save(usuario);
        Map<String, String> result = new HashMap<>();
        result.put("skin", skin);
        return result;
    }

    public String gerarToken(String username) {
        SecretKey key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        return Jwts.builder()
                .subject(username)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 86400000))
                .signWith(key)
                .compact();
    }

    public String validarToken(String token) {
        try {
            SecretKey key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
            return Jwts.parser().verifyWith(key).build()
                    .parseSignedClaims(token).getPayload().getSubject();
        } catch (Exception e) {
            return null;
        }
    }
}
