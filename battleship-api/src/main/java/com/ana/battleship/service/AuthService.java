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

@Service
public class AuthService implements UserDetailsService {

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
        if (usuarioRepo.existsByUsername(nome))
            throw new IllegalArgumentException("Nome já existe");
        if (usuarioRepo.existsByEmail(email))
            throw new IllegalArgumentException("Email já está em uso");
        Usuario usuario = Usuario.builder()
                .username(nome)
                .email(email)
                .senha(passwordEncoder.encode(senha))
                .build();
        usuarioRepo.save(usuario);
        return Map.of("token", gerarToken(nome), "username", nome);
    }

    public Map<String, String> login(String identificador, String senha) {
        // Tenta buscar por email primeiro, depois por username
        Optional<Usuario> optUsuario = usuarioRepo.findByEmail(identificador);
        if (optUsuario.isEmpty()) {
            optUsuario = usuarioRepo.findByUsername(identificador);
        }
        Usuario usuario = optUsuario
                .orElseThrow(() -> new IllegalArgumentException("Credenciais inválidas"));
        if (!passwordEncoder.matches(senha, usuario.getSenha()))
            throw new IllegalArgumentException("Credenciais inválidas");
        return Map.of("token", gerarToken(usuario.getUsername()), "username", usuario.getUsername());
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
