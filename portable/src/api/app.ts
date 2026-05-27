declare const process: {
  env: Record<string, string | undefined>;
};

import type {
  ApiError,
  AuthSession,
  InventoryItem,
  Product,
  SessionActionResult,
  User,
} from "@interfaces/app";
import type { InventoryMeta } from "@transformers/app";
import {
  toInventoryItem,
  toProduct,
  toSession,
} from "@transformers/app";

interface CredentialsInput {
  email: string;
  password: string;
}

export interface PartnerRegistrationInput extends CredentialsInput {
  name: string;
  phone: string;
  lat: number;
  long: number;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface PartnerProfileUpdateInput {
  name: string;
  email: string;
  phone: string;
  lat: number;
  long: number;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  password?: string;
}

export interface InventoryDraft {
  id?: string;
  medicineId: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  price: number;
  stockQuantity: number;
  expiryDate?: string;
  prescriptionRequired: boolean;
  imageUrl?: string;
}

interface RawSessionResponse {
  token: string;
  persona?: string;
  profile: Record<string, unknown>;
}

interface RawMedicine {
  id?: string;
  name?: string;
  description?: string;
  requires_prescription?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface RawInventory {
  id?: string;
  partner_id?: string;
  medicine_id?: string;
  quantity?: number;
  price?: number;
  created_at?: string;
  updated_at?: string;
}

interface InventoryResponse {
  inventory: RawInventory[];
}

interface CatalogResponse {
  medicines: RawMedicine[];
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH";
  body?: unknown;
  token?: string;
}

const API_BASE_URL = (
  window.localStorage.getItem("medrush.apiBaseUrl")
  || process.env.API_BASE_URL
  || "http://localhost:8000"
).replace(/\/$/, "");

const API_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS || "10000");
const API_AUTH_HEADER = process.env.API_AUTH_HEADER || "token";
const ENABLE_MOCK_DATA = (
  process.env.ENABLE_MOCK_DATA === "true"
  || process.env.ENABLE_MOCK_DATA === "1"
);

const STORAGE_KEYS = {
  session: "medrush.partnerhub.session",
  inventory: "medrush.partnerhub.inventory",
  catalog: "medrush.partnerhub.catalog",
  metadata: "medrush.partnerhub.inventoryMeta",
};

export const ENDPOINTS = {
  auth: {
    signup: "/api/v1/auth/signup",
    signin: "/api/v1/auth/signin",
  },
  partner: {
    account: "/api/v1/partner/account",
    inventory: "/api/v1/partner/inventory",
  },
  catalog: {
    medicines: "/api/v1/medicines",
  },
} as const;

function readStorage<T>(key: string, fallback: T): T {
  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function createApiError(
  partial: Partial<ApiError> & { message: string },
): ApiError {
  return {
    code: partial.code || "api_error",
    message: partial.message,
    status: partial.status,
    hint: partial.hint,
    details: partial.details,
  };
}

export function normalizeApiError(error: unknown): ApiError {
  if (
    typeof error === "object"
    && error !== null
    && "message" in error
    && "code" in error
  ) {
    return error as ApiError;
  }

  if (error instanceof Error) {
    return createApiError({
      code: "runtime_error",
      message: error.message,
    });
  }

  return createApiError({
    code: "unknown_error",
    message: "Something went wrong while contacting MedRush.",
  });
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const method = options.method || "GET";
  const headers = new Headers();

  headers.set("Accept", "application/json");

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set(API_AUTH_HEADER, options.token);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const apiMessage = (
        typeof payload === "object"
        && payload !== null
        && "error" in payload
      )
        ? String(payload.error)
        : `Request failed with status ${response.status}`;

      throw createApiError({
        status: response.status,
        code: "request_failed",
        message: apiMessage,
        details: payload,
      });
    }

    return payload as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw createApiError({
        code: "timeout",
        message: "The MedRush server took too long to respond.",
        hint: "Check that the backend is running on http://localhost:8000.",
      });
    }

    if (error instanceof TypeError) {
      throw createApiError({
        code: "network_error",
        message: "The MedRush server could not be reached from the browser.",
        hint: "This usually means the backend is offline or CORS is blocking requests on a different port.",
      });
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function mockCatalog(): Product[] {
  return [
    {
      id: "mock-paracetamol",
      medicineId: "mock-paracetamol",
      name: "Paracetamol 650",
      brand: "MediCore",
      category: "Tablet",
      description: "Mock catalog fallback for partner inventory screens.",
      price: 0,
      stockQuantity: 0,
      prescriptionRequired: false,
      availabilityText: "Not stocked yet",
      partnerId: null,
      partnerName: null,
    },
    {
      id: "mock-antibiotic",
      medicineId: "mock-antibiotic",
      name: "Azithromycin",
      brand: "AziHealth",
      category: "Tablet",
      description: "Use mock mode only when the backend catalog is unavailable.",
      price: 0,
      stockQuantity: 0,
      prescriptionRequired: true,
      availabilityText: "Not stocked yet",
      partnerId: null,
      partnerName: null,
    },
  ];
}

function readMetadata(): Record<string, InventoryMeta> {
  return readStorage<Record<string, InventoryMeta>>(STORAGE_KEYS.metadata, {});
}

function writeMetadata(metadata: Record<string, InventoryMeta>) {
  writeStorage(STORAGE_KEYS.metadata, metadata);
}

function saveDraftMetadata(draft: InventoryDraft) {
  const current = readMetadata();
  current[draft.medicineId] = {
    name: draft.name,
    brand: draft.brand,
    category: draft.category,
    description: draft.description,
    expiryDate: draft.expiryDate,
    prescriptionRequired: draft.prescriptionRequired,
    imageUrl: draft.imageUrl,
  };

  writeMetadata(current);
}

function mapCatalog(rawMedicines: RawMedicine[]): Product[] {
  const metadata = readMetadata();
  const products = rawMedicines.map((medicine) =>
    toProduct(medicine, medicine.id ? metadata[medicine.id] : undefined)
  );

  writeStorage(STORAGE_KEYS.catalog, products);
  return products;
}

export function loadCachedSession(): AuthSession<User> | null {
  return readStorage<AuthSession<User> | null>(STORAGE_KEYS.session, null);
}

export function saveCachedSession(session: AuthSession<User> | null) {
  if (!session) {
    window.localStorage.removeItem(STORAGE_KEYS.session);
    return;
  }

  writeStorage(STORAGE_KEYS.session, session);
}

export function loadCachedInventory(): InventoryItem[] {
  return readStorage<InventoryItem[]>(STORAGE_KEYS.inventory, []);
}

export function loadCachedCatalog(): Product[] {
  return readStorage<Product[]>(STORAGE_KEYS.catalog, []);
}

export function getCachedInventoryItem(itemId: string): InventoryItem | null {
  return loadCachedInventory().find((item) => item.id === itemId) || null;
}

async function getCatalogProducts(): Promise<Product[]> {
  try {
    const payload = await request<CatalogResponse>(ENDPOINTS.catalog.medicines, {
      method: "GET",
    });

    return mapCatalog(payload.medicines);
  } catch (error) {
    if (ENABLE_MOCK_DATA) {
      const mockData = mockCatalog();
      writeStorage(STORAGE_KEYS.catalog, mockData);
      return mockData;
    }

    throw error;
  }
}

export async function signInPartner(
  input: CredentialsInput,
): Promise<AuthSession<User>> {
  const payload = await request<RawSessionResponse>(ENDPOINTS.auth.signin, {
    method: "POST",
    body: {
      persona: "partner",
      email: input.email,
      password: input.password,
    },
  });

  const session = toSession(payload, "partner");
  saveCachedSession(session);
  return session;
}

export async function registerPartner(
  input: PartnerRegistrationInput,
): Promise<AuthSession<User>> {
  const payload = await request<RawSessionResponse>(ENDPOINTS.auth.signup, {
    method: "POST",
    body: {
      persona: "partner",
      name: input.name,
      email: input.email,
      password: input.password,
      phone: input.phone,
      lat: input.lat,
      long: input.long,
      address_line_1: input.addressLine1,
      address_line_2: input.addressLine2 || "",
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      country: input.country,
    },
  });

  const session = toSession(payload, "partner");
  saveCachedSession(session);
  return session;
}

export async function updatePartnerProfile(
  token: string,
  input: PartnerProfileUpdateInput,
): Promise<User> {
  const payload = await request<{ profile: Record<string, unknown> }>(
    ENDPOINTS.partner.account,
    {
      method: "PATCH",
      token,
      body: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        lat: input.lat,
        long: input.long,
        address_line_1: input.addressLine1,
        address_line_2: input.addressLine2 || "",
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        country: input.country,
        password: input.password || undefined,
      },
    },
  );

  const session = loadCachedSession();
  const nextProfile = toSession(
    { token, profile: payload.profile, persona: "partner" },
    "partner",
  ).profile;

  if (session) {
    saveCachedSession({
      ...session,
      profile: nextProfile,
      source: "cached",
    });
  }

  return nextProfile;
}

export async function loadInventoryWorkspace(
  token: string,
): Promise<{ inventory: InventoryItem[]; catalog: Product[] }> {
  const [catalog, payload] = await Promise.all([
    getCatalogProducts(),
    request<InventoryResponse>(ENDPOINTS.partner.inventory, {
      method: "GET",
      token,
    }),
  ]);

  const catalogMap = new Map(catalog.map((item) => [item.medicineId, item]));
  const metadata = readMetadata();
  const inventory = payload.inventory.map((item) =>
    toInventoryItem(
      item,
      typeof item.medicine_id === "string"
        ? catalogMap.get(item.medicine_id)
        : undefined,
      typeof item.medicine_id === "string"
        ? metadata[item.medicine_id]
        : undefined,
    )
  );

  writeStorage(STORAGE_KEYS.inventory, inventory);
  return { inventory, catalog };
}

export async function saveInventoryDraft(
  token: string,
  draft: InventoryDraft,
): Promise<InventoryItem> {
  saveDraftMetadata(draft);

  const payload = await request<InventoryResponse>(ENDPOINTS.partner.inventory, {
    method: "PUT",
    token,
    body: {
      items: [
        {
          medicine_id: draft.medicineId,
          quantity: draft.stockQuantity,
          price: draft.price,
        },
      ],
    },
  });

  const updatedRow = payload.inventory.find((item) => item.medicine_id === draft.medicineId)
    || payload.inventory[0];
  const catalog = loadCachedCatalog();
  const catalogMap = new Map(catalog.map((item) => [item.medicineId, item]));
  const metadata = readMetadata();
  const updatedItem = toInventoryItem(
    updatedRow,
    catalogMap.get(draft.medicineId),
    metadata[draft.medicineId],
  );

  const current = loadCachedInventory();
  const next = current.filter((item) => item.id !== updatedItem.id);
  next.push(updatedItem);
  writeStorage(STORAGE_KEYS.inventory, next);

  return updatedItem;
}

export async function markInventoryUnavailable(
  token: string,
  item: InventoryItem,
): Promise<InventoryItem> {
  return saveInventoryDraft(token, {
    id: item.id,
    medicineId: item.medicineId,
    name: item.name,
    brand: item.brand,
    category: item.category,
    description: item.description,
    price: item.price,
    stockQuantity: 0,
    expiryDate: item.expiryDate,
    prescriptionRequired: item.prescriptionRequired,
    imageUrl: item.imageUrl,
  });
}

export function logoutPartner(): SessionActionResult<null> {
  window.localStorage.removeItem(STORAGE_KEYS.session);
  return { ok: true, data: null };
}

// TODO(server): replace local medicine metadata overlays when public medicine
// create/update routes and partner order queue endpoints are available.
