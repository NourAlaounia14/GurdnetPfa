import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MonitoringService } from '../../services/monitoring';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, interval } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';

interface NetworkNode {
  id: number;
  ip: string;
  hostname: string;
  os_name?: string;
  device_type: string;
  status: string;
  icon: string;
  x: number;
  y: number;
  alert_count: number;
  first_seen: string;
  last_seen: string;
  latency_ms?: number | null;
  cpu_percent?: number | null;
  ram_percent?: number | null;
}

@Component({
  selector: 'app-network-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './network-map.html',
  styleUrl: './network-map.css',
})
export class NetworkMapComponent implements OnInit, OnDestroy {
  nodes: NetworkNode[] = [];
  selectedNode: NetworkNode | null = null;
  diagnostic: any = null;
  loading = false;
  error = '';
  totalDevices = 0;
  
  private destroy$ = new Subject<void>();

  constructor(
    private monitoringService: MonitoringService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  get hubNode(): NetworkNode | null {
    return this.nodes.find((node) => (node.device_type || '').toLowerCase() === 'switch') || null;
  }

  get connectedNodes(): NetworkNode[] {
    const hub = this.hubNode;
    return hub ? this.nodes.filter((node) => node.id !== hub.id) : this.nodes;
  }

  ngOnInit(): void {
    this.loadNetworkMap();
    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const ip = params.get('ip');
        if (ip && this.nodes.length > 0) {
          this.selectedNode = this.nodes.find((node) => node.ip === ip) || null;
        }
      });
    // Rafraîchir chaque 30 secondes
    interval(30000)
      .pipe(
        switchMap(() => this.monitoringService.getNetworkMap()),
        takeUntil(this.destroy$)
      )
      .subscribe(
        (data) => this.updateNetworkMap(data),
        (error) => console.error('Erreur refresh réseau:', error)
      );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadNetworkMap(): void {
    this.loading = true;
    this.monitoringService.getNetworkMap().subscribe(
      (data) => {
        this.updateNetworkMap(data);
        this.loading = false;
      },
      (error) => {
        console.error('Erreur:', error);
        this.error = 'Erreur lors du chargement de la carte réseau';
        this.loading = false;
      }
    );
  }

  updateNetworkMap(data: any): void {
    this.nodes = data.nodes || [];
    this.totalDevices = data.total_devices || 0;
    const selectedIp = this.route.snapshot.queryParamMap.get('ip');
    if (selectedIp) {
      this.selectedNode = this.nodes.find((node) => node.ip === selectedIp) || this.selectedNode;
    }
  }

  selectNode(node: NetworkNode): void {
    this.selectedNode = this.selectedNode?.id === node.id ? null : node;
    this.diagnostic = null;
  }

  getNodeColor(status: string): string {
    switch (status) {
      case 'online':
      case 'up':
        return '#10b981';
      case 'offline':
      case 'down':
        return '#ef4444';
      default:
        return '#9ca3af';
    }
  }

  getStatusLabel(status: string): string {
    return status === 'up' ? 'En ligne' : status === 'online' ? 'En ligne' : 'Hors ligne';
  }

  getDeviceTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      router: 'Routeur',
      switch: 'Switch',
      server: 'Serveur',
      workstation: 'Poste',
      printer: 'Imprimante',
      firewall: 'Pare-feu',
      unknown: 'Inconnu',
    };
    return labels[(type || 'unknown').toLowerCase()] || 'Équipement';
  }

  getMetricValue(value?: number | null, suffix = ''): string {
    return value === null || value === undefined ? 'N/A' : `${value}${suffix}`;
  }

  closePanel(): void {
    this.selectedNode = null;
    this.diagnostic = null;
  }

  openAlertsForNode(): void {
    if (!this.selectedNode) return;
    this.router.navigate(['/alertes'], { queryParams: { device_ip: this.selectedNode.ip } });
  }

  scanNode(): void {
    if (!this.selectedNode) return;
    this.router.navigate(['/scan'], { queryParams: { ip: this.selectedNode.ip } });
  }

  diagnoseNode(): void {
    if (!this.selectedNode) return;
    this.monitoringService.diagnoseDevice(this.selectedNode.id).subscribe((data) => {
      this.diagnostic = data;
    });
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('fr-FR');
  }
}
