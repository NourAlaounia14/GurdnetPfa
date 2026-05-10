import { AfterViewInit, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MonitoringService } from '../../services/monitoring';
import { Router } from '@angular/router';

interface AnomalyLog {
  id: number;
  timestamp: string;
  features: Record<string, number>;
  score: number;
  is_anomaly: boolean;
  alert_id: number | null;
}

@Component({
  selector: 'app-anomalies',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './anomalies.html',
  styleUrl: './anomalies.css',
})
export class Anomalies implements OnInit, AfterViewInit {
  anomalyHistory: AnomalyLog[] = [];
  chartData: any[] = [];
  loading = false;
  analyzing = false;
  error = '';
  lastAnalysis: any = null;

  featureSpecs = [
    { key: 'latency_ms', label: 'Latence' },
    { key: 'nb_open_ports', label: 'Ports ouverts' },
    { key: 'nb_new_devices', label: 'Nouveaux appareils' },
    { key: 'nb_alerts_1h', label: 'Alertes récentes' },
    { key: 'cpu_percent', label: 'CPU serveur' },
    { key: 'ram_percent', label: 'RAM serveur' },
    { key: 'hour_of_day', label: 'Heure' },
  ];

  constructor(
    private monitoringService: MonitoringService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadHistory();
  }

  ngAfterViewInit(): void {
    window.setTimeout(() => this.drawChart(), 100);
  }

  loadHistory(): void {
    this.loading = true;
    this.monitoringService.getAnomalyHistory(0, 30).subscribe({
      next: (data) => {
        this.anomalyHistory = data || [];
        this.prepareChartData();
        this.loading = false;
        window.setTimeout(() => this.drawChart(), 100);
      },
      error: () => {
        this.error = 'Erreur lors du chargement de l’historique IA';
        this.loading = false;
      },
    });
  }

  prepareChartData(): void {
    this.chartData = [...this.anomalyHistory]
      .reverse()
      .map((log) => ({
        name: this.formatTime(log.timestamp),
        score: Math.round(log.score * 100),
        isAnomaly: log.is_anomaly,
        timestamp: log.timestamp,
        features: log.features,
      }));
  }

  analyzeNow(): void {
    this.analyzing = true;
    this.monitoringService.detectAnomaly().subscribe({
      next: (result) => {
        this.lastAnalysis = result;
        this.analyzing = false;
        this.loadHistory();
      },
      error: () => {
        this.error = 'Erreur lors de l’analyse IA';
        this.analyzing = false;
      },
    });
  }

  openAlert(alertId?: number | null): void {
    const queryParams = alertId ? { alert_id: String(alertId), type: 'ANOMALY_DETECTED' } : { type: 'ANOMALY_DETECTED' };
    this.router.navigate(['/alertes'], { queryParams });
  }

  exportCsv(): void {
    const rows = [
      ['ID', 'Timestamp', 'Score', 'Anomalie', 'Alert ID', 'Features'],
      ...this.anomalyHistory.map((log) => [
        log.id,
        log.timestamp,
        log.score,
        log.is_anomaly ? 'Oui' : 'Non',
        log.alert_id || '',
        JSON.stringify(log.features || {}),
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `guardnet-anomalies-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  formatTime(dateString: string): string {
    return new Date(dateString).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('fr-FR');
  }

  getScoreColor(score: number): string {
    if (score < 40) return '#10b981';
    if (score < 60) return '#f59e0b';
    return '#ef4444';
  }

  getScoreLabel(score: number): string {
    if (score < 40) return 'Normal';
    if (score < 60) return 'Suspect';
    return 'Anomalie';
  }

  getAnomalyCount(): number {
    return this.anomalyHistory.filter((log) => log.is_anomaly).length;
  }

  getAverageScore(): number {
    if (this.anomalyHistory.length === 0) return 0;
    const sum = this.anomalyHistory.reduce((acc, log) => acc + log.score, 0);
    return Math.round((sum / this.anomalyHistory.length) * 100);
  }

  getRecentAnomalies(): AnomalyLog[] {
    return this.anomalyHistory.filter((log) => log.is_anomaly).slice(0, 5);
  }

  getLatestSource(): any {
    return this.lastAnalysis || this.anomalyHistory[0] || null;
  }

  getLatestScore(): number {
    const source = this.getLatestSource();
    return source?.score ? Math.round(source.score * 100) : 0;
  }

  getLatestConfidence(): string {
    const confidence = this.getLatestSource()?.confidence || this.getLatestSource()?.confidence_label || 'low';
    if (typeof confidence === 'number') {
      if (confidence >= 0.8) return 'high';
      if (confidence >= 0.6) return 'medium';
      return 'low';
    }
    return confidence;
  }

  getLatestFeatures(): Record<string, number> {
    const source = this.getLatestSource();
    return source?.features_used || source?.features || {};
  }

  getFeatureValue(key: string): string {
    const value = this.getLatestFeatures()[key];
    if (value === null || value === undefined) return '-';
    return Number.isInteger(value) ? String(value) : Number(value).toFixed(1);
  }

  getAnomalyReason(log: AnomalyLog): string {
    const features = log.features || {};
    const reasons = [];
    if ((features['latency_ms'] || 0) >= 100) reasons.push('latence élevée');
    if ((features['nb_new_devices'] || 0) > 0) reasons.push('nouvel appareil');
    if ((features['nb_alerts_1h'] || 0) >= 3) reasons.push('alertes rapprochées');
    if ((features['cpu_percent'] || 0) >= 60) reasons.push('charge serveur');
    return reasons.length ? reasons.join(', ') : 'comportement inhabituel';
  }

  formatLogFeature(log: AnomalyLog, key: string, digits = 1): string {
    const value = log.features?.[key];
    if (value === null || value === undefined) return 'N/A';
    return Number(value).toFixed(digits);
  }

  drawChart(): void {
    const canvas = document.getElementById('anomaly-chart') as HTMLCanvasElement;
    if (!canvas || this.chartData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = 320;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 42;
    const graphWidth = width - 2 * padding;
    const graphHeight = height - 2 * padding;

    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding + (graphHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    const thresholdY = height - padding - (0.6 * graphHeight);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(padding, thresholdY);
    ctx.lineTo(width - padding, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]);

    const step = graphWidth / Math.max(this.chartData.length - 1, 1);
    const points = this.chartData.map((item, index) => ({
      x: padding + index * step,
      y: height - padding - (item.score / 100) * graphHeight,
      item,
    }));

    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 3;
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();

    points.forEach((point) => {
      ctx.fillStyle = point.item.isAnomaly ? '#ef4444' : '#10b981';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}
