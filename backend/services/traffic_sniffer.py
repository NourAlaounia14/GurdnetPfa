from scapy.all import sniff, IP, TCP, UDP
from collections import Counter
from datetime import datetime


class TrafficSniffer:
    def capture(self, duration: int = 30) -> dict:
        """
        Capture le trafic réseau pendant `duration` secondes.
        Retourne un dict compatible avec TrafficMetric.
        """
        packets = sniff(timeout=duration, filter="ip")

        total_packets = len(packets)
        if total_packets == 0:
            return {
                "total_packets": 0,
                "tcp_pct": 0.0,
                "udp_pct": 0.0,
                "bytes_total": 0,
                "top_ips": [],
                "top_ports": [],
            }

        tcp_count = 0
        udp_count = 0
        bytes_total = 0
        ip_counter = Counter()
        port_counter = Counter()

        for pkt in packets:
            if IP in pkt:
                bytes_total += len(pkt)
                src_ip = pkt[IP].src
                ip_counter[src_ip] += 1

                if TCP in pkt:
                    tcp_count += 1
                    port_counter[pkt[TCP].dport] += 1
                elif UDP in pkt:
                    udp_count += 1
                    port_counter[pkt[UDP].dport] += 1

        tcp_pct = round(tcp_count / total_packets * 100, 2)
        udp_pct = round(udp_count / total_packets * 100, 2)

        top_ips = [
            {"ip": ip, "count": count}
            for ip, count in ip_counter.most_common(5)
        ]
        top_ports = [
            {"port": port, "count": count}
            for port, count in port_counter.most_common(5)
        ]

        return {
            "total_packets": total_packets,
            "tcp_pct": tcp_pct,
            "udp_pct": udp_pct,
            "bytes_total": bytes_total,
            "top_ips": top_ips,
            "top_ports": top_ports,
        }