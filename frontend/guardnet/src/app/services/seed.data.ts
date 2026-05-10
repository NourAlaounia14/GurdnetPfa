const now = new Date();

const minutesAgo = (minutes: number): string => {
  const date = new Date(now.getTime() - minutes * 60 * 1000);
  return date.toISOString();
};

const average = (values: Array<number | null | undefined>): number => {
  const numericValues = values.filter((value): value is number => typeof value === 'number');
  if (numericValues.length === 0) return 0;
  return Number((numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length).toFixed(2));
};

const iconByType: Record<string, string> = {
  switch: 'SW',
  workstation: 'PC',
  unknown: 'UNK',
};

export const seedDevices = [
  {
    id: 1,
    ip: '192.168.1.2',
    hostname: 'SW-LAN-01',
    os_name: 'Switch manageable',
    device_type: 'switch',
    status: 'online',
    first_seen: minutesAgo(180),
    last_seen: minutesAgo(1),
    latency_ms: 2,
    cpu_percent: null,
    ram_percent: null,
  },
  {
    id: 2,
    ip: '192.168.1.10',
    hostname: 'PC-TEST-01',
    os_name: 'Windows 11 Pro',
    device_type: 'workstation',
    status: 'online',
    first_seen: minutesAgo(176),
    last_seen: minutesAgo(1),
    latency_ms: 4,
    cpu_percent: 18,
    ram_percent: 42,
  },
  {
    id: 3,
    ip: '192.168.1.11',
    hostname: 'PC-DEV-02',
    os_name: 'Windows 11 Pro',
    device_type: 'workstation',
    status: 'online',
    first_seen: minutesAgo(174),
    last_seen: minutesAgo(2),
    latency_ms: 6,
    cpu_percent: 31,
    ram_percent: 55,
  },
  {
    id: 4,
    ip: '192.168.1.12',
    hostname: 'PC-ADMIN-03',
    os_name: 'Ubuntu Desktop 24.04',
    device_type: 'workstation',
    status: 'online',
    first_seen: minutesAgo(171),
    last_seen: minutesAgo(2),
    latency_ms: 5,
    cpu_percent: 27,
    ram_percent: 48,
  },
  {
    id: 5,
    ip: '192.168.1.13',
    hostname: 'PC-LAB-04',
    os_name: 'Windows 10 Pro',
    device_type: 'workstation',
    status: 'online',
    first_seen: minutesAgo(168),
    last_seen: minutesAgo(3),
    latency_ms: 7,
    cpu_percent: 23,
    ram_percent: 49,
  },
];

export const seedSummary = {
  total: seedDevices.length,
  online: seedDevices.filter((device) => device.status === 'online').length,
  offline: seedDevices.filter((device) => device.status === 'offline').length,
  avg_cpu_percent: average(seedDevices.map((device) => device.cpu_percent)),
  avg_ram_percent: average(seedDevices.map((device) => device.ram_percent)),
  avg_latency_ms: average(seedDevices.map((device) => device.latency_ms)),
  monitoring_interval_sec: 30,
  last_monitoring_at: minutesAgo(0),
};

export const seedTrafficHistory = [
  { timestamp: minutesAgo(25), total_packets: 2140, tcp_pct: 64, udp_pct: 30, bytes_total: 1843000, top_ips: [{ ip: '192.168.1.10', count: 42 }, { ip: '192.168.1.11', count: 31 }], top_ports: [{ port: 443, count: 38 }, { port: 53, count: 25 }] },
  { timestamp: minutesAgo(20), total_packets: 2380, tcp_pct: 66, udp_pct: 28, bytes_total: 2291000, top_ips: [{ ip: '192.168.1.10', count: 49 }, { ip: '192.168.1.12', count: 28 }], top_ports: [{ port: 443, count: 44 }, { port: 445, count: 18 }] },
  { timestamp: minutesAgo(15), total_packets: 2610, tcp_pct: 68, udp_pct: 25, bytes_total: 2410000, top_ips: [{ ip: '192.168.1.11', count: 53 }, { ip: '192.168.1.13', count: 26 }], top_ports: [{ port: 443, count: 46 }, { port: 3389, count: 12 }] },
  { timestamp: minutesAgo(10), total_packets: 2475, tcp_pct: 62, udp_pct: 31, bytes_total: 2164000, top_ips: [{ ip: '192.168.1.12', count: 39 }, { ip: '192.168.1.10', count: 35 }], top_ports: [{ port: 53, count: 34 }, { port: 443, count: 30 }] },
  { timestamp: minutesAgo(5), total_packets: 2890, tcp_pct: 70, udp_pct: 23, bytes_total: 2768000, top_ips: [{ ip: '192.168.1.10', count: 58 }, { ip: '192.168.1.11', count: 47 }], top_ports: [{ port: 443, count: 51 }, { port: 3389, count: 15 }] },
];

export const seedAlerts = [
  {
    id: 101,
    type: 'PORT_CHANGE',
    severity: 'warning',
    message: 'Port RDP detecte sur PC-TEST-01 : 3389/tcp',
    device_id: 2,
    device_ip: '192.168.1.10',
    resolved: false,
    created_at: minutesAgo(12),
  },
];

export const seedAlertStats = {
  total: seedAlerts.length,
  unresolved: seedAlerts.filter((alert) => !alert.resolved).length,
  resolved: seedAlerts.filter((alert) => alert.resolved).length,
  by_type: {
    PORT_CHANGE: 1,
  },
  by_severity: {
    warning: 1,
  },
};

export const seedThresholds = {
  latency_max_ms: 200,
  cpu_alert_pct: 85,
  ram_alert_pct: 90,
  anomaly_score_threshold: 0.5,
  monitoring_interval_sec: 30,
  network_outage_min_devices: 3,
};

export const seedUsers = [
  { id: 1, nom: 'Admin GuardNet', email: 'admin@guardnet.local', created_at: minutesAgo(1440) },
];

export const seedNetworkMap = (() => {
  const centerX = 400;
  const centerY = 300;
  const radius = 210;
  const switchDevice = seedDevices.find((device) => device.device_type === 'switch');
  const leafDevices = switchDevice ? seedDevices.filter((device) => device.id !== switchDevice.id) : seedDevices;
  const leafNodes = leafDevices.map((device, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(leafDevices.length, 1) - Math.PI / 2;

    return {
      ...device,
      icon: iconByType[device.device_type] || 'DEV',
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      alert_count: seedAlerts.filter((alert) => alert.device_id === device.id && !alert.resolved).length,
    };
  });

  const switchNode = switchDevice
    ? {
        ...switchDevice,
        icon: iconByType[switchDevice.device_type] || 'SW',
        x: centerX,
        y: centerY,
        alert_count: seedAlerts.filter((alert) => alert.device_id === switchDevice.id && !alert.resolved).length,
      }
    : null;

  return {
    total_devices: seedDevices.length,
    nodes: switchNode ? [switchNode, ...leafNodes] : leafNodes,
  };
})();

export const seedAnomalyHistory = [
  {
    id: 201,
    timestamp: minutesAgo(40),
    features: { latency_ms: 5, nb_open_ports: 7, nb_new_devices: 0, nb_alerts_1h: 0, cpu_percent: 22, ram_percent: 45, hour_of_day: 9 },
    score: 0.12,
    is_anomaly: false,
    alert_id: null,
  },
  {
    id: 202,
    timestamp: minutesAgo(30),
    features: { latency_ms: 6, nb_open_ports: 7, nb_new_devices: 0, nb_alerts_1h: 0, cpu_percent: 24, ram_percent: 48, hour_of_day: 10 },
    score: 0.18,
    is_anomaly: false,
    alert_id: null,
  },
  {
    id: 203,
    timestamp: minutesAgo(20),
    features: { latency_ms: 7, nb_open_ports: 8, nb_new_devices: 0, nb_alerts_1h: 1, cpu_percent: 31, ram_percent: 55, hour_of_day: 11 },
    score: 0.29,
    is_anomaly: false,
    alert_id: null,
  },
  {
    id: 204,
    timestamp: minutesAgo(8),
    features: { latency_ms: 5, nb_open_ports: 8, nb_new_devices: 0, nb_alerts_1h: 1, cpu_percent: 25, ram_percent: 49, hour_of_day: 12 },
    score: 0.21,
    is_anomaly: false,
    alert_id: null,
  },
];

export const seedLatestAnalysis = {
  is_anomaly: false,
  score: 0.21,
  confidence: 'medium',
  confidence_score: 0.74,
  features_used: seedAnomalyHistory[3].features,
  alert_created: false,
  alert_id: null,
};

export const seedReport = {
  summary: seedSummary,
  devices: seedDevices,
  traffic_history: seedTrafficHistory,
  active_alerts: seedAlerts.filter((alert) => !alert.resolved).length,
};
