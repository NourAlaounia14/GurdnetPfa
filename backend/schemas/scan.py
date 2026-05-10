import re
from typing import List

from pydantic import BaseModel, field_validator


class ScanRequest(BaseModel):
    ip_range: str
    scan_type: str = "complet"

    @field_validator("ip_range")
    def validate_ip_range(cls, value):
        cidr_pattern = r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/\d{1,2}$"
        range_pattern = r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}-\d{1,3}$"
        if not re.match(cidr_pattern, value) and not re.match(range_pattern, value):
            raise ValueError("Format invalide. Exemple : 192.168.1.0/24")
        return value

    @field_validator("scan_type")
    def validate_scan_type(cls, value):
        if value != "complet":
            raise ValueError("scan_type doit etre 'complet'")
        return value


class PortInfo(BaseModel):
    port: int
    protocol: str
    service: str
    version: str
    is_new_port: bool


class DeviceOut(BaseModel):
    ip: str
    hostname: str
    state: str
    os_name: str
    device_type: str
    ports: List[PortInfo]
    is_new: bool


class ScanResponse(BaseModel):
    scan_id: int
    ip_range: str
    scan_type: str
    devices_found: int

    class Config:
        from_attributes = True
