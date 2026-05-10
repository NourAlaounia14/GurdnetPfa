import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  email: string = '';
  password: string = '';
  errorMessage: string = '';
  successMessage = '';
  isLoading: boolean = false;
  mode: 'login' | 'register' = 'login';
  nom = '';

  constructor(private authService: Auth, private router: Router) {}

  onLogin(): void {
    this.errorMessage = '';
    this.isLoading = true;

    this.authService.login(this.email, this.password).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Email ou mot de passe incorrect';
      },
    });
  }

  onRegister(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.isLoading = true;

    this.authService.register(this.nom, this.email, this.password).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = 'Compte administrateur cree. Vous pouvez vous connecter.';
        this.mode = 'login';
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.detail || 'Impossible de creer le compte administrateur';
      },
    });
  }
}
