import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { seedSummary } from '../../services/seed.data';

interface ScanStartResponse {
  scan_id: number;
  status: string;
  ip_range: string;
}

interface ScanHistoryItem {
  id: number;
  ip_range: string;
  scan_type: string;
  started_at: string;
  finished_at?: string | null;
  devices_found: number;
}

interface ScanPort {
  port: number;
  protocol?: string;
  service?: string;
  version?: string;
  is_new_port?: boolean;
}

interface ScanDevice {
  id?: number;
  device_ip?: string;
  ip?: string;
  hostname?: string | null;
  os_name?: string | null;
  device_type?: string | null;
  ports?: ScanPort[];
  is_new?: boolean;
}

interface ScanDetailResponse {
  scan: ScanHistoryItem;
  devices: ScanDevice[];
}

interface MonitoringSummary {
  total: number;
  online?: number;
  offline?: number;
}

interface AlertItem {
  id: number;
  type: string;
  severity: 'critical' | 'warning' | string;
  message: string;
  created_at?: string;
  resolved?: boolean;
}

@Component({
  selector: 'app-scan',
  imports: [CommonModule, FormsModule],
  templateUrl: './scan.html',
  styleUrl: './scan.css',
})
export class Scan implements OnInit, OnDestroy {
  @ViewChild('scanFormCard') scanFormCard?: ElementRef<HTMLElement>;

  private readonly scanApiUrl = 'http://127.0.0.1:8000/scan';
  private readonly alertsApiUrl = 'http://127.0.0.1:8000/alerts';
  private readonly monitoringApiUrl = 'http://127.0.0.1:8000/monitoring';
  private readonly useSeedPreview = true;
  private pollTimer: number | undefined;

  ipRange = '';
  scanType: 'complet' = 'complet';
  formSubmitted = false;

  isScanning = false;
  isLoadingResults = false;
  isLoadingHistory = false;
  isLoadingStats = false;
  isLoadingAlerts = false;

  errorMessage = '';
  isDemoData = false;
  activeScanId: number | null = null;
  activeScan: ScanHistoryItem | null = null;
  history: ScanHistoryItem[] = [];
  devices: ScanDevice[] = [];
  scanAlerts: AlertItem[] = [];
  selectedDevice: ScanDevice | null = null;
  monitoringSummary: MonitoringSummary = { total: 0 };

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const ip = params.get('ip');
      if (ip) {
        this.ipRange = ip;
        this.formSubmitted = false;
      }
    });
    this.loadPageData();
  }

  ngOnDestroy(): void {
    this.clearPollTimer();
  }

  loadPageData(): void {
    this.loadHistory();
    this.loadMonitoringSummary();
  }

  startScan(): void {
    this.formSubmitted = true;
    this.errorMessage = '';
    this.isDemoData = false;
    this.scanAlerts = [];
    this.selectedDevice = null;

    if (!this.isIpRangeValid || this.isScanning) {
      return;
    }

    this.isScanning = true;
    this.isLoadingResults = true;
    this.devices = [];
    this.activeScan = null;

    if (this.useSeedPreview) {
      this.showDemoScanPreview();
      return;
    }

    this.http
      .post<ScanStartResponse>(`${this.scanApiUrl}/start`, {
        ip_range: this.ipRange.trim(),
        scan_type: 'complet',
      })
      .subscribe({
        next: (response) => {
          this.activeScanId = response.scan_id;
          this.pollScan(response.scan_id);
        },
        error: () => {
          this.errorMessage = 'Impossible de lancer le scan. Vérifiez la plage IP et réessayez.';
          this.isScanning = false;
          this.isLoadingResults = false;
        },
      });
  }

  loadHistory(): void {
    this.isLoadingHistory = true;

    if (this.useSeedPreview) {
      this.showDemoScanPreview();
      this.isLoadingHistory = false;
      return;
    }

    this.http.get<ScanHistoryItem[]>(`${this.scanApiUrl}/history`).subscribe({
      next: (history) => {
        this.history = history || [];
        this.isLoadingHistory = false;
        if (this.history.length === 0 && !this.activeScan) {
          this.showDemoScanPreview();
        }
      },
      error: () => {
        this.isLoadingHistory = false;
        if (!this.activeScan) {
          this.showDemoScanPreview();
        }
      },
    });
  }

  loadMonitoringSummary(): void {
    this.isLoadingStats = true;

    if (this.useSeedPreview) {
      this.monitoringSummary = {
        total: seedSummary.total,
        online: seedSummary.online,
        offline: seedSummary.offline,
      };
      this.isLoadingStats = false;
      return;
    }

    this.http.get<MonitoringSummary>(`${this.monitoringApiUrl}/summary`).subscribe({
      next: (summary) => {
        this.monitoringSummary = summary || { total: 0 };
        this.isLoadingStats = false;
      },
      error: () => {
        this.isLoadingStats = false;
      },
    });
  }

  viewScan(scanId: number): void {
    this.clearPollTimer();
    this.errorMessage = '';
    this.isDemoData = false;
    this.scanAlerts = [];
    this.selectedDevice = null;
    this.activeScanId = scanId;
    this.isLoadingResults = true;

    if (this.useSeedPreview) {
      this.showDemoScanPreview();
      return;
    }

    this.http.get<ScanDetailResponse>(`${this.scanApiUrl}/${scanId}`).subscribe({
      next: (response) => {
        this.activeScan = response.scan;
        this.devices = response.devices || [];
        this.isLoadingResults = false;
        this.isScanning = false;
        this.loadRecentScanAlerts();
      },
      error: () => {
        this.errorMessage = 'Impossible de charger les résultats du scan.';
        this.isLoadingResults = false;
      },
    });
  }

  prefillScan(item: ScanHistoryItem, scrollToForm = true): void {
    this.ipRange = item.ip_range;
    this.scanType = 'complet';
    this.formSubmitted = false;

    if (scrollToForm) {
      window.setTimeout(() => {
        this.scanFormCard?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  }

  exportCsv(): void {
    if (!this.activeScanId || !this.activeScan) {
      return;
    }

    const scan = this.activeScan;
    this.errorMessage = '';

    if (this.isDemoData) {
      this.downloadCsvBlob(this.buildDemoCsv(), this.getCsvFileName(scan));
      return;
    }

    this.http
      .get(`${this.scanApiUrl}/${this.activeScanId}/export`, { responseType: 'blob' })
      .subscribe({
        next: (blob) => {
          this.downloadCsvBlob(blob, this.getCsvFileName(scan));
        },
        error: () => {
          this.errorMessage = 'Impossible d exporter le fichier CSV.';
        },
      });
  }

  loadRecentScanAlerts(): void {
    if (this.isDemoData) {
      return;
    }

    this.isLoadingAlerts = true;

    this.http.get<AlertItem[]>(`${this.alertsApiUrl}?resolved=false`).subscribe({
      next: (alerts) => {
        const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
        this.scanAlerts = (alerts || []).filter((alert) => {
          if (!alert.created_at) {
            return false;
          }

          return new Date(alert.created_at).getTime() >= twoMinutesAgo;
        });
        this.isLoadingAlerts = false;
      },
      error: () => {
        this.isLoadingAlerts = false;
      },
    });
  }

  openAlertsPage(): void {
    this.router.navigate(['/alertes'], { queryParams: { resolved: 'false' } });
  }

  openNetworkMap(device: ScanDevice): void {
    this.router.navigate(['/carte-reseau'], { queryParams: { ip: this.getDeviceIp(device) } });
  }

  openDeviceDetails(device: ScanDevice): void {
    this.selectedDevice = device;
  }

  closeDeviceDetails(): void {
    this.selectedDevice = null;
  }

  stopHistoryAction(event: MouseEvent): void {
    event.stopPropagation();
  }

  get isIpRangeValid(): boolean {
    const value = this.ipRange.trim();
    const cidrPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/;
    const rangePattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}-\d{1,3}$/;
    return cidrPattern.test(value) || rangePattern.test(value);
  }

  get showIpError(): boolean {
    return this.formSubmitted && !this.isIpRangeValid;
  }

  get totalScans(): number {
    return this.history.length;
  }

  get lastScan(): ScanHistoryItem | null {
    return this.history.length > 0 ? this.history[0] : null;
  }

  get canShowResults(): boolean {
    return !!this.activeScanId && !!this.activeScan?.finished_at && !this.isLoadingResults;
  }

  get resultDurationLabel(): string {
    return this.activeScan ? this.getDurationLabel(this.activeScan) : '-';
  }

  get alertPanelClass(): string {
    const hasCritical = this.scanAlerts.some((alert) => alert.severity === 'critical');
    return hasCritical ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50';
  }

  getDeviceIp(device: ScanDevice): string {
    return device.ip || device.device_ip || '-';
  }

  getDeviceTypeLabel(deviceType?: string | null): string {
    const labels: Record<string, string> = {
      server: 'Serveur',
      router: 'Routeur',
      workstation: 'Poste de travail',
      switch: 'Switch',
      unknown: 'Inconnu',
    };

    return labels[this.normalizeDeviceType(deviceType)] || labels['unknown'];
  }

  getDeviceTypeClass(deviceType?: string | null): string {
    const classes: Record<string, string> = {
      server: 'bg-blue-100 text-blue-700 ring-blue-200',
      router: 'bg-orange-100 text-orange-700 ring-orange-200',
      workstation: 'bg-green-100 text-green-700 ring-green-200',
      switch: 'bg-purple-100 text-purple-700 ring-purple-200',
      unknown: 'bg-gray-100 text-gray-700 ring-gray-200',
    };

    return classes[this.normalizeDeviceType(deviceType)] || classes['unknown'];
  }

  getScanTypeLabel(scanType?: string | null): string {
    return scanType === 'complet' ? 'Complet' : 'Automatique';
  }

  getScanTypeClass(scanType?: string | null): string {
    return scanType === 'complet'
      ? 'bg-indigo-100 text-indigo-700 ring-indigo-200'
      : 'bg-blue-100 text-blue-700 ring-blue-200';
  }

  hasNewPort(device: ScanDevice): boolean {
    return (device.ports || []).some((port) => port.is_new_port);
  }

  getPortLabel(port: ScanPort): string {
    return `${port.port}${port.service ? '/' + port.service : ''}`;
  }

  getScanDateLabel(value?: string | null): string {
    if (!value) {
      return '-';
    }

    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .format(new Date(value))
      .replace(':', 'h')
      .replace(',', ' à');
  }

  getMachineLabel(count: number): string {
    return `${count || 0} ${count === 1 ? 'machine' : 'machines'}`;
  }

  getDurationLabel(item: ScanHistoryItem): string {
    if (!item.started_at || !item.finished_at) {
      return '-';
    }

    const startedAt = new Date(item.started_at).getTime();
    const finishedAt = new Date(item.finished_at).getTime();
    const seconds = Math.max(0, Math.round((finishedAt - startedAt) / 1000));
    return `${seconds} secondes`;
  }

  getAlertIconClass(severity: string): string {
    return severity === 'critical' ? 'bg-red-600 text-white' : 'bg-orange-500 text-white';
  }

  private pollScan(scanId: number): void {
    this.http.get<ScanDetailResponse>(`${this.scanApiUrl}/${scanId}`).subscribe({
      next: (response) => {
        this.activeScan = response.scan;
        this.devices = response.devices || [];

        if (response.scan?.finished_at) {
          this.isScanning = false;
          this.isLoadingResults = false;
          this.loadHistory();
          this.loadMonitoringSummary();
          this.loadRecentScanAlerts();
          return;
        }

        this.pollTimer = window.setTimeout(() => this.pollScan(scanId), 3000);
      },
      error: () => {
        this.errorMessage = 'Impossible de récupérer les résultats du scan.';
        this.isScanning = false;
        this.isLoadingResults = false;
      },
    });
  }

  private clearPollTimer(): void {
    if (this.pollTimer) {
      window.clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  showDemoScanPreview(): void {
    const finishedAt = new Date();
    const startedAt = new Date(finishedAt.getTime() - 42 * 1000);

    this.isDemoData = true;
    this.isScanning = false;
    this.isLoadingResults = false;
    this.errorMessage = '';
    this.activeScanId = -1;
    this.activeScan = {
      id: -1,
      ip_range: '192.168.1.0/24',
      scan_type: 'complet',
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      devices_found: 5,
    };
    this.devices = [
      {
        id: 1,
        ip: '192.168.1.2',
        hostname: 'SW-LAN-01',
        os_name: 'Switch manageable',
        device_type: 'switch',
        is_new: false,
        ports: [
          { port: 80, service: 'http' },
          { port: 161, service: 'snmp' },
        ],
      },
      {
        id: 2,
        ip: '192.168.1.10',
        hostname: 'PC-TEST-01',
        os_name: 'Windows 11 Pro',
        device_type: 'workstation',
        is_new: false,
        ports: [
          { port: 135, service: 'msrpc' },
          { port: 445, service: 'smb' },
          { port: 3389, service: 'rdp', is_new_port: true },
        ],
      },
      {
        id: 3,
        ip: '192.168.1.11',
        hostname: 'PC-DEV-02',
        os_name: 'Windows 11 Pro',
        device_type: 'workstation',
        is_new: false,
        ports: [
          { port: 135, service: 'msrpc' },
          { port: 445, service: 'smb' },
        ],
      },
      {
        id: 4,
        ip: '192.168.1.12',
        hostname: 'PC-ADMIN-03',
        os_name: 'Ubuntu Desktop 24.04',
        device_type: 'workstation',
        is_new: false,
        ports: [{ port: 22, service: 'ssh' }],
      },
      {
        id: 5,
        ip: '192.168.1.13',
        hostname: 'PC-LAB-04',
        os_name: 'Windows 10 Pro',
        device_type: 'workstation',
        is_new: false,
        ports: [{ port: 445, service: 'smb' }],
      },
    ];
    this.history = this.activeScan ? [this.activeScan] : [];
    this.scanAlerts = [
      {
        id: -1,
        type: 'PORT_CHANGE',
        severity: 'warning',
        message: 'Port RDP detecte sur PC-TEST-01 : 3389/tcp',
        created_at: finishedAt.toISOString(),
        resolved: false,
      },
    ];
  }

  private buildDemoCsv(): Blob {
    const rows = [
      ['IP', 'Hostname', 'OS', 'Type', 'Ports ouverts', 'Nouveau'],
      ...this.devices.map((device) => [
        this.getDeviceIp(device),
        device.hostname || '-',
        device.os_name || '-',
        this.getDeviceTypeLabel(device.device_type),
        (device.ports || []).map((port) => this.getPortLabel(port)).join(' '),
        device.is_new ? 'Oui' : 'Non',
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  }

  private downloadCsvBlob(blob: Blob, fileName: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  private getCsvFileName(scan: ScanHistoryItem): string {
    const date = new Date(scan.finished_at || scan.started_at);
    const day = String(date.getDate()).padStart(2, '0');
    const month = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(date).replace('.', '');
    const year = date.getFullYear();
    const range = scan.ip_range.replace(/\/.*/, '').replace(/[^0-9.]/g, '_');
    return `scan_${range}_${day}${month}${year}.csv`;
  }

  private normalizeDeviceType(deviceType?: string | null): string {
    return (deviceType || 'unknown').toLowerCase();
  }
}
