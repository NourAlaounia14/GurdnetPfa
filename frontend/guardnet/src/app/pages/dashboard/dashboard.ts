import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MonitoringService } from '../../services/monitoring';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class Dashboard implements OnInit, OnDestroy {
  summary: any = { total: 0, online: 0, offline: 0, monitoring_interval_sec: 30 };
  devices: any[] = [];
  trafficHistory: any[] = [];
  alerts: any[] = [];
  alertStats: any = { total: 0, unresolved: 0, resolved: 0 };
  anomalyHistory: any[] = [];
  lastAnalysis: any = null;
  isAnalyzing = false;
  updatedAt = new Date();
  dashboardScanRange = '192.168.1.0/24';
  isScanStarting = false;
  scanMessage = '';
  diagnosingDeviceId: number | null = null;
  diagnosticResult: any = null;

  private intervalId: number | undefined;

  constructor(
    private monitoringService: MonitoringService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadData();
    this.intervalId = window.setInterval(() => this.loadData(), 30000);
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
    }
  }

  loadData(): void {
    this.updatedAt = new Date();
    this.monitoringService.getSummary().subscribe((data) => this.summary = data || this.summary);
    this.monitoringService.getDevices().subscribe((data) => this.devices = data || []);
    this.monitoringService.getTrafficHistory().subscribe((data) => this.trafficHistory = data || []);
    this.monitoringService.getAlerts({ resolved: false, limit: 6 }).subscribe((data) => this.alerts = data || []);
    this.monitoringService.getAlertStats().subscribe((data) => this.alertStats = data || this.alertStats);
    this.monitoringService.getAnomalyHistory(0, 12).subscribe((data) => this.anomalyHistory = data || []);
  }

  navigate(path: string, queryParams?: Record<string, string>): void {
    this.router.navigate([path], { queryParams });
  }

  startCompleteScan(): void {
    this.scanMessage = '';
    if (!this.isIpRangeValid(this.dashboardScanRange)) {
      this.scanMessage = 'Plage IP invalide. Exemple attendu : 192.168.1.0/24';
      return;
    }

    this.isScanStarting = true;
    this.monitoringService.startCompleteScan(this.dashboardScanRange.trim()).subscribe({
      next: (response) => {
        this.isScanStarting = false;
        this.scanMessage = `Scan complet lancé sur ${response.ip_range}. Suivi disponible dans la page Scan.`;
        this.loadData();
      },
      error: () => {
        this.isScanStarting = false;
        this.scanMessage = 'Impossible de lancer le scan complet pour le moment.';
      },
    });
  }

  runAiAnalysis(): void {
    this.isAnalyzing = true;
    this.monitoringService.detectAnomaly().subscribe({
      next: (result) => {
        this.lastAnalysis = result;
        this.isAnalyzing = false;
        this.loadData();
      },
      error: () => {
        this.isAnalyzing = false;
      },
    });
  }

  diagnoseDevice(device: any): void {
    this.diagnosingDeviceId = device.id;
    this.monitoringService.diagnoseDevice(device.id).subscribe({
      next: (result) => {
        this.diagnosticResult = result;
        this.diagnosingDeviceId = null;
        this.loadData();
      },
      error: () => {
        this.diagnosticResult = {
          ip: device.ip,
          hostname: device.hostname,
          status: device.status,
          source: 'indisponible',
        };
        this.diagnosingDeviceId = null;
      },
    });
  }

  generateReport(): void {
    const rows = [
      ['section', 'key', 'value'],
      ['summary', 'generated_at', new Date().toLocaleString('fr-FR')],
      ['summary', 'total_devices', this.summary.total || 0],
      ['summary', 'online_devices', this.summary.online || 0],
      ['summary', 'offline_devices', this.summary.offline || 0],
      ['summary', 'avg_cpu_percent', this.summary.avg_cpu_percent || 0],
      ['summary', 'avg_ram_percent', this.summary.avg_ram_percent || 0],
      ['summary', 'avg_latency_ms', this.summary.avg_latency_ms || 0],
      ['summary', 'unresolved_alerts', this.alertStats.unresolved || this.alerts.length],
      ['summary', 'detected_anomalies', this.getAnomalyCount()],
      ['summary', 'ai_status', this.getAiStatusLabel()],
      ...this.alerts.map((alert) => ['alert', alert.type, `${alert.severity} ${alert.device_ip || ''} ${alert.message}`]),
      ...this.devices.map((device) => ['device', device.ip, `${device.hostname || '-'} ${device.status} CPU=${device.cpu_percent ?? '-'} RAM=${device.ram_percent ?? '-'}`]),
    ];
    const report = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([report], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `guardnet-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  getOnlinePercent(): number {
    if (!this.summary.total) return 0;
    return Math.round((this.summary.online / this.summary.total) * 100);
  }

  getOfflineDevices(): any[] {
    return this.devices.filter((device) => !this.isOnline(device.status));
  }

  getCriticalAlertCount(): number {
    return this.alerts.filter((alert) => alert.severity === 'critical' && !alert.resolved).length;
  }

  getAnomalyCount(): number {
    return this.anomalyHistory.filter((item) => item.is_anomaly).length;
  }

  getAiScore(): number {
    const source = this.getLatestAiSource();
    return source?.score ? Math.round(source.score * 100) : 0;
  }

  getAiStatusLabel(): string {
    const score = this.getAiScore();
    if (score >= 60) return 'Anomalie active';
    if (score >= 40) return 'Surveillance renforcée';
    return 'Comportement normal';
  }

  getLatestAiSource(): any {
    return this.lastAnalysis || this.anomalyHistory[0] || null;
  }

  getLatestAiFeatures(): any {
    const source = this.getLatestAiSource();
    return source?.features_used || source?.features || {};
  }

  getFeatureValue(key: string): string {
    const value = this.getLatestAiFeatures()[key];
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(1);
    return String(value);
  }

  getConfidenceLabel(): string {
    const confidence = this.getLatestAiSource()?.confidence || this.getLatestAiSource()?.confidence_label || 'low';
    if (typeof confidence === 'number') {
      if (confidence >= 0.8) return 'high';
      if (confidence >= 0.6) return 'medium';
      return 'low';
    }
    return confidence;
  }

  getLatestTraffic(): any {
    return this.trafficHistory[this.trafficHistory.length - 1] || {};
  }

  getTopTrafficItems(key: 'top_ips' | 'top_ports'): any[] {
    return this.getLatestTraffic()[key] || [];
  }

  getMetricValue(value: number | null | undefined, suffix: string): string {
    return value === null || value === undefined ? '-' : `${value}${suffix}`;
  }

  getStatusClass(status: string): string {
    return this.isOnline(status) ? 'online' : 'offline';
  }

  getStatusLabel(status: string): string {
    return this.isOnline(status) ? 'en ligne' : 'hors ligne';
  }

  getDeviceTypeLabel(deviceType?: string | null): string {
    const labels: Record<string, string> = {
      router: 'Routeur',
      switch: 'Switch',
      server: 'Serveur',
      workstation: 'Poste',
      printer: 'Imprimante',
      firewall: 'Pare-feu',
      unknown: 'Inconnu',
    };
    return labels[(deviceType || 'unknown').toLowerCase()] || 'Équipement';
  }

  getMonitoringTimeLabel(): string {
    const source = this.summary.last_monitoring_at || this.updatedAt;
    return new Date(source).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  private isOnline(status: string): boolean {
    return status === 'online' || status === 'up';
  }

  private isIpRangeValid(value: string): boolean {
    const trimmed = value.trim();
    const cidrPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/;
    const rangePattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}-\d{1,3}$/;
    return cidrPattern.test(trimmed) || rangePattern.test(trimmed);
  }

}
