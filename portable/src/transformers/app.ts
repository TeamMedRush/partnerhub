import type {
  Address,
  AuthSession,
  InventoryItem,
  Persona,
  Product,
  User,
} from "@interfaces/app";

interface RawRecord {
  [key: string]: unknown;
}

interface RawSessionResponse {
  token: string;
  persona?: string;
  profile: RawRecord;
}

interface RawMedicine extends RawRecord {
  id?: string;
  name?: string;
  description?: string;
  requires_prescription?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface RawInventory extends RawRecord {
  id?: string;
  partner_id?: string;
  medicine_id?: string;
  quantity?: number;
  price?: number;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryMeta {
  name?: string;
  brand?: string;
  category?: string;
  description?: string;
  expiryDate?: string;
  prescriptionRequired?: boolean;
  imageUrl?: string;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export function toAddress(record: RawRecord | undefined): Address {
  if (!record) {
    return {};
  }

  return {
    label: typeof record.name === "string" ? record.name : undefined,
    latitude: asNumber(record.lat ?? record.latitude),
    longitude: asNumber(record.long ?? record.longitude),
    addressLine1: typeof record.address_line_1 === "string"
      ? record.address_line_1
      : undefined,
    addressLine2: typeof record.address_line_2 === "string"
      ? record.address_line_2
      : undefined,
    city: typeof record.city === "string" ? record.city : undefined,
    state: typeof record.state === "string" ? record.state : undefined,
    pincode: typeof record.pincode === "string" ? record.pincode : undefined,
    country: typeof record.country === "string" ? record.country : undefined,
  };
}

function deriveBrand(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts[0] || "MedRush";
}

function deriveCategory(name: string, description: string) {
  const haystack = `${name} ${description}`.toLowerCase();

  if (haystack.includes("syrup")) {
    return "Syrup";
  }

  if (haystack.includes("tablet")) {
    return "Tablet";
  }

  if (haystack.includes("capsule")) {
    return "Capsule";
  }

  if (haystack.includes("drops")) {
    return "Drops";
  }

  return "General medicine";
}

export function toUser(record: RawRecord, persona: Persona): User {
  return {
    id: typeof record.id === "string" ? record.id : "",
    persona,
    name: typeof record.name === "string" ? record.name : "Partner",
    email: typeof record.email === "string" ? record.email : "",
    phone: typeof record.phone === "string" ? record.phone : "",
    latitude: asNumber(record.lat),
    longitude: asNumber(record.long),
    address: toAddress(record),
    createdAt: typeof record.created_at === "string"
      ? record.created_at
      : undefined,
    updatedAt: typeof record.updated_at === "string"
      ? record.updated_at
      : undefined,
  };
}

export function toSession(
  payload: RawSessionResponse,
  persona: Persona,
): AuthSession<User> {
  return {
    token: payload.token,
    persona,
    profile: toUser(payload.profile, persona),
    source: "remote",
  };
}

export function toProduct(
  raw: RawMedicine,
  meta?: InventoryMeta,
): Product {
  const name = meta?.name || (typeof raw.name === "string" ? raw.name : "Medicine");
  const description = meta?.description || (typeof raw.description === "string" ? raw.description : "");
  const prescriptionRequired = meta?.prescriptionRequired
    ?? Boolean(raw.requires_prescription);

  return {
    id: typeof raw.id === "string" ? raw.id : "",
    medicineId: typeof raw.id === "string" ? raw.id : "",
    name,
    brand: meta?.brand || deriveBrand(name),
    category: meta?.category || deriveCategory(name, description),
    description,
    price: 0,
    stockQuantity: 0,
    prescriptionRequired,
    imageUrl: meta?.imageUrl,
    availabilityText: "Not stocked yet",
    partnerId: null,
    partnerName: null,
    createdAt: typeof raw.created_at === "string" ? raw.created_at : undefined,
    updatedAt: typeof raw.updated_at === "string" ? raw.updated_at : undefined,
  };
}

export function toInventoryItem(
  raw: RawInventory,
  medicine?: Product,
  meta?: InventoryMeta,
): InventoryItem {
  const stockQuantity = asNumber(raw.quantity) ?? 0;
  const name = meta?.name || medicine?.name || (typeof raw.medicine_id === "string" ? raw.medicine_id : "Medicine");
  const description = meta?.description || medicine?.description || "";
  const prescriptionRequired = meta?.prescriptionRequired
    ?? medicine?.prescriptionRequired
    ?? false;

  let status: InventoryItem["status"] = "active";

  if (stockQuantity <= 0) {
    status = "unavailable";
  } else if (stockQuantity <= 5) {
    status = "low";
  }

  return {
    id: typeof raw.id === "string" ? raw.id : "",
    medicineId: typeof raw.medicine_id === "string" ? raw.medicine_id : "",
    name,
    brand: meta?.brand || medicine?.brand || deriveBrand(name),
    category: meta?.category || medicine?.category || deriveCategory(name, description),
    description,
    price: asNumber(raw.price) ?? 0,
    stockQuantity,
    expiryDate: meta?.expiryDate,
    prescriptionRequired,
    imageUrl: meta?.imageUrl,
    partnerId: typeof raw.partner_id === "string" ? raw.partner_id : undefined,
    status,
    createdAt: typeof raw.created_at === "string" ? raw.created_at : undefined,
    updatedAt: typeof raw.updated_at === "string" ? raw.updated_at : undefined,
  };
}

export function formatAddress(address?: Address | null): string {
  if (!address) {
    return "Not configured yet";
  }

  const parts = [
    address.addressLine1,
    address.addressLine2,
    address.city,
    address.state,
    address.pincode,
  ].filter(Boolean);

  return parts.length ? parts.join(", ") : "Not configured yet";
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
