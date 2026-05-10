import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MonitoringService } from '../../services/monitoring';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, interval } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';

interface Alert {
  id: number;
  type: string;
  severity: string;
  message: string;
  device_id: number;
  device_ip?: string;
  resolved: boolean;
  created_at: string;
}

@Component({
  selector: 'app-alertes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './alertes.html',
  styleUrl: './alertes.css',
})
export class Alertes implements OnInit, OnDestroy {
  alerts: Alert[] = [];
  filteredAlerts: Alert[] = [];
  loading = false;
  error = '';
  
  // Filtres
  filterType = '';
  filterSeverity = '';
  filterResolved = '';
  filterDeviceIp = '';
  filterAlertId = '';
  
  // Stats
  stats = { total: 0, unresolved: 0, resolved: 0, by_type: {}, by_severity: {} };
  
  // Pagination
  currentPage = 1;
  pageSize = 10;

  private destroy$ = new Subject<void>();

  constructor(
    private monitoringService: MonitoringService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.filterType = params.get('type') || this.filterType;
      this.filterSeverity = params.get('severity') || this.filterSeverity;
      this.filterResolved = params.get('resolved') || this.filterResolved;
      this.filterDeviceIp = params.get('device_ip') || this.filterDeviceIp;
      this.filterAlertId = params.get('alert_id') || this.filterAlertId;
      this.applyFilters();
    });
    this.loadAlerts();
    this.loadStats();
    
    // Rafraîchir les alertes chaque 30 secondes
    interval(30000)
      .pipe(
        switchMap(() => this.monitoringService.getAlerts()),
        takeUntil(this.destroy$)
      )
      .subscribe(
        (data) => {
          this.alerts = data;
          this.applyFilters();
        },
        (error) => console.error('Erreur refresh alertes:', error)
      );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAlerts(): void {
    this.loading = true;
    this.monitoringService.getAlerts({ limit: 100 }).subscribe(
      (data) => {
        this.alerts = data;
        this.applyFilters();
        this.loading = false;
      },
      (error) => {
        console.error('Erreur:', error);
        this.error = 'Erreur lors du chargement des alertes';
        this.loading = false;
      }
    );
  }

  loadStats(): void {
    this.monitoringService.getAlertStats().subscribe(
      (data) => {
        this.stats = data;
      },
      (error) => console.error('Erreur stats:', error)
    );
  }

  applyFilters(): void {
    this.filteredAlerts = this.alerts.filter((alert) => {
      let match = true;

      if (this.filterType && alert.type !== this.filterType) {
        match = false;
      }

      if (this.filterSeverity && alert.severity !== this.filterSeverity) {
        match = false;
      }

      if (this.filterResolved === 'true' && !alert.resolved) {
        match = false;
      } else if (this.filterResolved === 'false' && alert.resolved) {
        match = false;
      }

      if (this.filterDeviceIp && this.getDeviceIp(alert) !== this.filterDeviceIp) {
        match = false;
      }

      if (this.filterAlertId && String(alert.id) !== this.filterAlertId) {
        match = false;
      }

      return match;
    });
  }

  onFilterChange(): void {
    this.applyFilters();
    this.currentPage = 1;
  }

  getPaginatedAlerts(): Alert[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredAlerts.slice(start, start + this.pageSize);
  }

  getTotalPages(): number {
    return Math.ceil(this.filteredAlerts.length / this.pageSize);
  }

  getSeverityClass(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'severity-critical';
      case 'high':
      case 'warning':
        return 'severity-high';
      case 'medium':
        return 'severity-medium';
      default:
        return 'severity-low';
    }
  }

  getTypeIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'NEW_DEVICE': '🆕',
      'NEW_UNKNOWN_DEVICE': 'UNK',
      'PORT_CHANGE': '🔧',
      'DEVICE_DOWN': '❌',
      'LATENCY_HIGH': '⏱️',
      'ANOMALY_DETECTED': '⚠️',
      'DEVICE_UP': '✅',
    };
    return icons[type] || '📢';
  }

  openDevice(alert: Alert): void {
    const ip = this.getDeviceIp(alert);
    if (ip) {
      this.router.navigate(['/carte-reseau'], { queryParams: { ip } });
    }
  }

  openType(alert: Alert): void {
    if (alert.type === 'ANOMALY_DETECTED') {
      this.router.navigate(['/anomalies'], { queryParams: { alert_id: alert.id } });
      return;
    }

    this.filterType = alert.type;
    this.onFilterChange();
  }

  getTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'NEW_DEVICE': 'Nouvel appareil',
      'NEW_UNKNOWN_DEVICE': 'Appareil inconnu',
      'PORT_CHANGE': 'Changement de port',
      'DEVICE_DOWN': 'Appareil hors ligne',
      'LATENCY_HIGH': 'Latence élevée',
      'ANOMALY_DETECTED': 'Anomalie détectée',
      'DEVICE_UP': 'Appareil en ligne',
    };
    return labels[type] || type;
  }

  resolveAlert(alert: Alert): void {
    this.monitoringService.resolveAlert(alert.id).subscribe(
      () => {
        alert.resolved = true;
        this.loadStats();
      },
      (error) => console.error('Erreur résolution:', error)
    );
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('fr-FR');
  }

  clearFilters(): void {
    this.filterType = '';
    this.filterSeverity = '';
    this.filterResolved = '';
    this.filterDeviceIp = '';
    this.filterAlertId = '';
    this.applyFilters();
  }

  getUnresolvedCount(): number {
    return this.alerts.filter((a) => !a.resolved).length;
  }

  getDeviceIp(alert: Alert): string {
    if (alert.device_ip) return alert.device_ip;
    const match = alert.message?.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
    return match ? match[0] : '';
  }

  exportCsv(): void {
    const rows = [
      ['ID', 'Type', 'Severite', 'Device IP', 'Message', 'Date', 'Statut'],
      ...this.filteredAlerts.map((alert) => [
        alert.id,
        alert.type,
        alert.severity,
        this.getDeviceIp(alert),
        alert.message,
        alert.created_at,
        alert.resolved ? 'Resolue' : 'Active',
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `guardnet-alertes-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }
}

