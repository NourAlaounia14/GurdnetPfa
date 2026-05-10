import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, of } from 'rxjs';
import { Auth } from './auth';
import {
  seedAlerts,
  seedAlertStats,
  seedAnomalyHistory,
  seedDevices,
  seedLatestAnalysis,
  seedNetworkMap,
  seedReport,
  seedSummary,
  seedThresholds,
  seedTrafficHistory,
} from './seed.data';

@Injectable({
  providedIn: 'root'
})
export class MonitoringService {
  private apiUrl = 'http://127.0.0.1:8000/monitoring';
  private alertsUrl = 'http://127.0.0.1:8000/alerts';
  private anomalyUrl = 'http://127.0.0.1:8000/anomaly';
  private scanUrl = 'http://127.0.0.1:8000/scan';
  private readonly useSeedPreview = true;

  constructor(private http: HttpClient, private auth: Auth) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${this.auth.getToken()}`
    });
  }

  getSummary(): Observable<any> {
    if (this.useSeedPreview) return of(seedSummary);
    return this.http.get(`${this.apiUrl}/summary`, {
      headers: this.getHeaders()
    }).pipe(catchError(() => of(seedSummary)));
  }

  getDevices(): Observable<any> {
    if (this.useSeedPreview) return of(seedDevices);
    return this.http.get(`${this.apiUrl}/devices`, {
      headers: this.getHeaders()
    }).pipe(catchError(() => of(seedDevices)));
  }

  // Network Map
  getNetworkMap(): Observable<any> {
    if (this.useSeedPreview) return of(seedNetworkMap);
    return this.http.get(`${this.apiUrl}/network`, {
      headers: this.getHeaders()
    }).pipe(catchError(() => of(seedNetworkMap)));
  }

  getDeviceHistory(deviceId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/device/${deviceId}/history`, {
      headers: this.getHeaders()
    }).pipe(catchError(() => of([])));
  }

  getTrafficHistory(): Observable<any> {
    if (this.useSeedPreview) return of(seedTrafficHistory);
    return this.http.get(`${this.apiUrl}/traffic/history`, {
      headers: this.getHeaders()
    }).pipe(catchError(() => of(seedTrafficHistory)));
  }

  // Alerts
  getAlerts(filters?: {
    type?: string;
    severity?: string;
    resolved?: boolean;
    device_id?: number;
    device_ip?: string;
    skip?: number;
    limit?: number;
  }): Observable<any> {
    if (this.useSeedPreview) return of(this.filterSeedAlerts(filters));
    let params = new URLSearchParams();
    if (filters) {
      if (filters.type) params.append('type', filters.type);
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.resolved !== undefined) params.append('resolved', String(filters.resolved));
      if (filters.device_id) params.append('device_id', String(filters.device_id));
      if (filters.device_ip) params.append('device_ip', filters.device_ip);
      if (filters.skip) params.append('skip', String(filters.skip));
      if (filters.limit) params.append('limit', String(filters.limit));
    }
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.http.get<any[]>(`${this.alertsUrl}${queryString}`, {
      headers: this.getHeaders()
    }).pipe(catchError(() => of(this.filterSeedAlerts(filters))));
  }

  getAlertStats(): Observable<any> {
    if (this.useSeedPreview) return of(seedAlertStats);
    return this.http.get(`${this.alertsUrl}/stats`, {
      headers: this.getHeaders()
    }).pipe(catchError(() => of(seedAlertStats)));
  }

  resolveAlert(alertId: number): Observable<any> {
    if (this.useSeedPreview) return of({ message: 'Alerte resolue localement', alert_id: alertId });
    return this.http.patch(`${this.alertsUrl}/${alertId}/resolve`, {}, {
      headers: this.getHeaders()
    }).pipe(catchError(() => of({ message: 'Alerte resolue localement', alert_id: alertId })));
  }

  // Anomalies
  getAnomalyHistory(skip: number = 0, limit: number = 20): Observable<any> {
    if (this.useSeedPreview) return of(seedAnomalyHistory.slice(skip, skip + limit));
    return this.http.get(`${this.anomalyUrl}/history?skip=${skip}&limit=${limit}`, {
      headers: this.getHeaders()
    }).pipe(catchError(() => of(seedAnomalyHistory.slice(skip, skip + limit))));
  }

  detectAnomaly(): Observable<any> {
    if (this.useSeedPreview) return of(seedLatestAnalysis);
    return this.http.post(`${this.anomalyUrl}/detect`, {}, {
      headers: this.getHeaders()
    }).pipe(catchError(() => of(seedLatestAnalysis)));
  }

  startCompleteScan(ipRange: string): Observable<any> {
    if (this.useSeedPreview) {
      return of({
        scan_id: -1,
        status: 'demo',
        ip_range: ipRange,
        scan_type: 'complet',
        message: 'Scan complet lance en mode apercu',
      });
    }
    return this.http.post(`${this.scanUrl}/start`, {
      ip_range: ipRange,
      scan_type: 'complet',
    }, {
      headers: this.getHeaders()
    }).pipe(catchError(() => of({
      scan_id: -1,
      status: 'demo',
      ip_range: ipRange,
      scan_type: 'complet',
      message: 'Scan complet lance en mode apercu',
    })));
  }

  getThresholds(): Observable<any> {
    if (this.useSeedPreview) return of(seedThresholds);
    return this.http.get('http://127.0.0.1:8000/settings/thresholds', {
      headers: this.getHeaders()
    }).pipe(catchError(() => of(seedThresholds)));
  }

  updateThresholds(thresholds: Record<string, number | string>): Observable<any> {
    if (this.useSeedPreview) return of({ message: 'Seuils sauvegardes localement', thresholds });
    return this.http.put('http://127.0.0.1:8000/settings/thresholds', thresholds, {
      headers: this.getHeaders()
    }).pipe(catchError(() => of({ message: 'Seuils sauvegardes localement', thresholds })));
  }

  getMonitoringReport(): Observable<any> {
    if (this.useSeedPreview) return of(seedReport);
    return this.http.get(`${this.apiUrl}/report`, {
      headers: this.getHeaders()
    }).pipe(catchError(() => of(seedReport)));
  }

  diagnoseDevice(deviceId: number): Observable<any> {
    if (this.useSeedPreview) {
      const device = seedDevices.find((item) => item.id === deviceId);
      return of({
        device_id: deviceId,
        cpu_percent: device?.cpu_percent ?? 0,
        ram_percent: device?.ram_percent ?? 0,
        latency_ms: device?.latency_ms ?? 0,
        source: 'seed-preview',
      });
    }
    return this.http.get(`${this.apiUrl}/device/${deviceId}/diagnose`, {
      headers: this.getHeaders()
    }).pipe(catchError(() => {
      const device = seedDevices.find((item) => item.id === deviceId);
      return of({
        device_id: deviceId,
        cpu_percent: device?.cpu_percent ?? 0,
        ram_percent: device?.ram_percent ?? 0,
        latency_ms: device?.latency_ms ?? 0,
        source: 'seed-fallback',
      });
    }));
  }

  private filterSeedAlerts(filters?: {
    type?: string;
    severity?: string;
    resolved?: boolean;
    device_id?: number;
    device_ip?: string;
    skip?: number;
    limit?: number;
  }): any[] {
    let alerts = [...seedAlerts];

    if (filters?.type) alerts = alerts.filter((alert) => alert.type === filters.type);
    if (filters?.severity) alerts = alerts.filter((alert) => alert.severity === filters.severity);
    if (filters?.resolved !== undefined) alerts = alerts.filter((alert) => alert.resolved === filters.resolved);
    if (filters?.device_id) alerts = alerts.filter((alert) => alert.device_id === filters.device_id);
    if (filters?.device_ip) alerts = alerts.filter((alert) => alert.device_ip === filters.device_ip);

    const skip = filters?.skip || 0;
    const limit = filters?.limit || alerts.length;
    return alerts.slice(skip, skip + limit);
  }
}
