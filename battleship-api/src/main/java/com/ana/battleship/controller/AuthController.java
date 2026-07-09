package com.ana.battleship.controller;

import com.ana.battleship.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> registrar(@RequestBody Map<String, String> body) {
        return authService.registrar(body.get("nome"), body.get("email"), body.get("password"));
    }

    @PostMapping("/login")
    public Map<String, String> login(@RequestBody Map<String, String> body) {
        return authService.login(body.get("username"), body.get("password"));
    }

    @PutMapping("/skin")
    public Map<String, String> atualizarSkin(@RequestBody Map<String, String> body, Authentication auth) {
        String username = auth.getName();
        return authService.atualizarSkin(username, body.get("skin"));
    }
}
