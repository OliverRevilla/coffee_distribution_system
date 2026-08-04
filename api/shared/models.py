from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    SELLER = "seller"


class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class RouteStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class WaypointStatus(str, Enum):
    PENDING = "pending"
    VISITED = "visited"
    SKIPPED = "skipped"


class ComplaintCategory(str, Enum):
    QUALITY = "quality"
    DELIVERY = "delivery"
    PRICING = "pricing"
    OTHER = "other"


class ComplaintStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class ComplaintPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class User(BaseModel):
    id: Optional[int] = None
    email: str
    full_name: str
    role: UserRole
    status: UserStatus = UserStatus.ACTIVE
    dni: Optional[str] = None
    phone: Optional[str] = None
    residency: Optional[str] = None
    azure_b2c_id: str
    created_at: Optional[datetime] = None


class CoffeeVariant(BaseModel):
    id: Optional[int] = None
    name: str
    description: Optional[str] = None
    sku: str
    price: float
    image_url: Optional[str] = None
    is_active: bool = True
    created_at: Optional[datetime] = None


class InventoryItem(BaseModel):
    id: Optional[int] = None
    variant_id: int
    quantity: int = 0
    warehouse_location: Optional[str] = None
    reorder_point: int = 10
    last_updated: Optional[datetime] = None
    updated_by: Optional[int] = None


class Sale(BaseModel):
    id: Optional[int] = None
    seller_id: int
    variant_id: int
    quantity: int
    unit_price: float
    total_amount: float
    customer_name: Optional[str] = None
    customer_address: Optional[str] = None
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None
    sale_date: Optional[datetime] = None
    notes: Optional[str] = None


class Route(BaseModel):
    id: Optional[int] = None
    name: str
    description: Optional[str] = None
    assigned_seller_id: Optional[int] = None
    status: RouteStatus = RouteStatus.PENDING
    route_date: date
    created_at: Optional[datetime] = None


class RouteWaypoint(BaseModel):
    id: Optional[int] = None
    route_id: int
    sequence: int
    customer_name: Optional[str] = None
    address: Optional[str] = None
    latitude: float
    longitude: float
    estimated_arrival: Optional[datetime] = None
    actual_arrival: Optional[datetime] = None
    status: WaypointStatus = WaypointStatus.PENDING
    notes: Optional[str] = None


class GPSLocation(BaseModel):
    id: Optional[int] = None
    seller_id: int
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    timestamp: Optional[datetime] = None


class Complaint(BaseModel):
    id: Optional[int] = None
    seller_id: int
    customer_name: Optional[str] = None
    subject: str
    description: str
    category: Optional[ComplaintCategory] = None
    status: ComplaintStatus = ComplaintStatus.OPEN
    priority: ComplaintPriority = ComplaintPriority.MEDIUM
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
