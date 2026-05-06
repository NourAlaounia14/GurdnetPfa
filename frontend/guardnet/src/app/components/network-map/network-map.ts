import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MonitoringService } from '../../services/monitoring';
import { Subject, interval } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';

interface NetworkNode {
  id: number;
  ip: string;
  hostname: string;
  device_type: string;
  status: string;
  icon: string;
  x: number;
  y: number;
  alert_count: number;
  first_seen: string;
  last_seen: string;
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
  loading = false;
  error = '';
  totalDevices = 0;
  
  private destroy$ = new Subject<void>();

  constructor(private monitoringService: MonitoringService) {}

  ngOnInit(): void {
    this.loadNetworkMap();
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
  }

  selectNode(node: NetworkNode): void {
    this.selectedNode = this.selectedNode?.id === node.id ? null : node;
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

  closePanel(): void {
    this.selectedNode = null;
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('fr-FR');
  }
}
