import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NetworkMapComponent } from '../../components/network-map/network-map';

@Component({
  selector: 'app-network',
  standalone: true,
  imports: [CommonModule, NetworkMapComponent],
  templateUrl: './network.html',
  styleUrl: './network.css',
})
export class NetworkComponent {}
