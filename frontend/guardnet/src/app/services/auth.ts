import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, of, tap } from 'rxjs';
import { seedUsers } from './seed.data';

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

  register(nom: string, email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, { nom, email, password });
  }

  getUsers(): Observable<any[]> {
    return this.http.get<any[]>('http://127.0.0.1:8000/users/', {
      headers: { Authorization: `Bearer ${this.getToken()}` }
    }).pipe(catchError(() => of(seedUsers)));
  }

  deleteUser(userId: number): Observable<any> {
    return this.http.delete(`http://127.0.0.1:8000/users/${userId}`, {
      headers: { Authorization: `Bearer ${this.getToken()}` }
    }).pipe(catchError(() => of({ message: 'Utilisateur supprime localement', user_id: userId })));
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
