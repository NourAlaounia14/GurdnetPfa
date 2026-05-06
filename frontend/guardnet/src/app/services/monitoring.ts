import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Auth } from './auth';

@Injectable({
  providedIn: 'root'
})
export class MonitoringService {
  private apiUrl = 'http://127.0.0.1:8000/monitoring';
  private alertsUrl = 'http://127.0.0.1:8000/alerts';
  private anomalyUrl = 'http://127.0.0.1:8000/anomaly';

  constructor(private http: HttpClient, private auth: Auth) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${this.auth.getToken()}`
    });
  }

  getSummary(): Observable<any> {
    return this.http.get(`${this.apiUrl}/summary`, {
      headers: this.getHeaders()
    });
  }

  getDevices(): Observable<any> {
    return this.http.get(`${this.apiUrl}/devices`, {
      headers: this.getHeaders()
    });
  }

  // Network Map
  getNetworkMap(): Observable<any> {
    return this.http.get(`${this.apiUrl}/network`, {
      headers: this.getHeaders()
    });
  }

  getDeviceHistory(deviceId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/device/${deviceId}/history`, {
      headers: this.getHeaders()
    });
  }

  getTrafficHistory(): Observable<any> {
    return this.http.get(`${this.apiUrl}/traffic/history`, {
      headers: this.getHeaders()
    });
  }

  // Alerts
  getAlerts(filters?: {
    type?: string;
    severity?: string;
    resolved?: boolean;
    device_id?: number;
    skip?: number;
    limit?: number;
  }): Observable<any> {
    let params = new URLSearchParams();
    if (filters) {
      if (filters.type) params.append('type', filters.type);
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.resolved !== undefined) params.append('resolved', String(filters.resolved));
      if (filters.device_id) params.append('device_id', String(filters.device_id));
      if (filters.skip) params.append('skip', String(filters.skip));
      if (filters.limit) params.append('limit', String(filters.limit));
    }
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.http.get(`${this.alertsUrl}${queryString}`, {
      headers: this.getHeaders()
    });
  }

  getAlertStats(): Observable<any> {
    return this.http.get(`${this.alertsUrl}/stats`, {
      headers: this.getHeaders()
    });
  }

  resolveAlert(alertId: number): Observable<any> {
    return this.http.patch(`${this.alertsUrl}/${alertId}/resolve`, {}, {
      headers: this.getHeaders()
    });
  }

  // Anomalies
  getAnomalyHistory(skip: number = 0, limit: number = 20): Observable<any> {
    return this.http.get(`${this.anomalyUrl}/history?skip=${skip}&limit=${limit}`, {
      headers: this.getHeaders()
    });
  }

  detectAnomaly(): Observable<any> {
    return this.http.post(`${this.anomalyUrl}/detect`, {}, {
      headers: this.getHeaders()
    });
  }
}
