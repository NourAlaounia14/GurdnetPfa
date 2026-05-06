import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MonitoringService } from '../../services/monitoring';

interface AnomalyLog {
  id: number;
  timestamp: string;
  features: any;
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

  constructor(private monitoringService: MonitoringService) {}

  ngOnInit(): void {
    this.loadHistory();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.drawChart(), 100);
  }

  loadHistory(): void {
    this.loading = true;
    this.monitoringService.getAnomalyHistory(0, 30).subscribe(
      (data) => {
        this.anomalyHistory = data;
        this.prepareChartData();
        this.loading = false;
        setTimeout(() => this.drawChart(), 100);
      },
      (error) => {
        console.error('Erreur:', error);
        this.error = 'Erreur lors du chargement de l\'historique';
        this.loading = false;
      }
    );
  }

  prepareChartData(): void {
    // Préparer les données pour le graphique
    this.chartData = this.anomalyHistory
      .reverse()
      .map((log, index) => ({
        name: this.formatTime(log.timestamp),
        score: Math.round(log.score * 100),
        isAnomaly: log.is_anomaly,
        timestamp: log.timestamp,
        features: log.features,
      }));
  }

  analyzeNow(): void {
    this.analyzing = true;
    this.monitoringService.detectAnomaly().subscribe(
      (result) => {
        this.lastAnalysis = result;
        this.analyzing = false;
        // Recharger l'historique après l'analyse
        this.loadHistory();
      },
      (error) => {
        console.error('Erreur analyse:', error);
        this.error = 'Erreur lors de l\'analyse';
        this.analyzing = false;
      }
    );
  }

  formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('fr-FR');
  }

  getScoreColor(score: number): string {
    if (score < 30) return '#10b981'; // Vert
    if (score < 60) return '#f59e0b'; // Orange
    return '#ef4444'; // Rouge
  }

  getScoreLabel(score: number): string {
    if (score < 30) return 'Normal';
    if (score < 60) return 'Suspects';
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

  drawChart(): void {
    // Utiliser canvas pour dessiner un graphique simple
    const canvas = document.getElementById('anomaly-chart') as HTMLCanvasElement;
    if (!canvas || this.chartData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = 300;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;
    const graphWidth = width - 2 * padding;
    const graphHeight = height - 2 * padding;

    // Fond blanc
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    // Grille
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padding + (graphHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Données
    const maxScore = 100;
    const itemWidth = graphWidth / this.chartData.length;

    this.chartData.forEach((item, index) => {
      const x = padding + index * itemWidth + itemWidth / 2;
      const barHeight = (item.score / maxScore) * graphHeight;
      const y = height - padding - barHeight;

      // Barre
      const color = item.isAnomaly ? '#ef4444' : '#3b82f6';
      ctx.fillStyle = color;
      ctx.fillRect(x - itemWidth / 2 + 4, y, itemWidth - 8, barHeight);
    });

    // Ligne de seuil anomalie (score 60)
    const thresholdY = height - padding - (0.6 * graphHeight);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding, thresholdY);
    ctx.lineTo(width - padding, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}


