import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private apiUrl = 'http://127.0.0.1:8000/auth';

  constructor(private http: HttpClient, private router: Router) {}

  private getStorage(): Storage | null {
    if (typeof window === 'undefined' || !window?.localStorage) {
      return null;
    }
    return window.localStorage;
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, { email, password }).pipe(
      tap((response: any) => {
        const storage = this.getStorage();
        if (storage) {
          storage.setItem('token', response.access_token);
          storage.setItem('nom', response.nom);
          storage.setItem('email', response.email);
        }
      })
    );
  }

  logout(): void {
    const storage = this.getStorage();
    if (storage) {
      storage.removeItem('token');
      storage.removeItem('nom');
      storage.removeItem('email');
    }
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    const storage = this.getStorage();
    return !!storage?.getItem('token');
  }

  getToken(): string | null {
    const storage = this.getStorage();
    return storage?.getItem('token') ?? null;
  }

  getNom(): string | null {
    const storage = this.getStorage();
    return storage?.getItem('nom') ?? null;
  }
}