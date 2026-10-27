const FOCO360_BASE_URL = "https://foco360.replit.app";
const API_KEY = process.env.FOCO360_API_KEY || "";

interface Foco360Client {
  id: string;
  name: string;
  email: string;
  company: string;
}

interface Foco360Usage {
  limit: number;
  count: number;
  remaining: number;
}

export interface SsoVerifyResponse {
  success: boolean;
  client: Foco360Client;
  usage: Foco360Usage;
  message?: string;
}

export interface AuthResponse {
  success: boolean;
  client: Foco360Client;
  product: { code: string; name: string };
  usage: Foco360Usage;
  message?: string;
}

export interface CheckResponse {
  success: boolean;
  canCreate: boolean;
  resourceType: string;
  usage: number;
  limit: number;
  remaining: number;
  unlimited: boolean;
  message?: string;
}

export interface ConsumeResponse {
  success: boolean;
  resourceType: string;
  usage: number;
  limit: number;
  remaining: number;
  unlimited: boolean;
  message?: string;
}

export interface EntitlementsResponse {
  success: boolean;
  client: Foco360Client;
  product: { id: string; code: string; name: string };
  entitlements: Array<{
    resourceType: string;
    usage: number;
    limit: number;
    remaining: number;
    unlimited: boolean;
    canCreate: boolean;
    renewable: boolean;
    renewalDays: number;
    lastResetAt: string;
    expiresAt: string;
  }>;
  message?: string;
}

async function foco360Fetch(path: string, options: RequestInit = {}): Promise<any> {
  const url = `${FOCO360_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    const err: any = new Error(data.message || `FOCO360 error: ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function verifySsoToken(token: string): Promise<SsoVerifyResponse> {
  return foco360Fetch("/api/external/sso/verify", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function authenticateClient(email: string, password: string): Promise<AuthResponse> {
  return foco360Fetch("/api/external/auth", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function checkUsage(email: string): Promise<CheckResponse> {
  return foco360Fetch(`/api/external/check?email=${encodeURIComponent(email)}&resourceType=uses`);
}

export async function consumeUsage(email: string, amount = 1): Promise<ConsumeResponse> {
  return foco360Fetch("/api/external/consume", {
    method: "POST",
    body: JSON.stringify({ email, resourceType: "uses", amount }),
  });
}

export async function getEntitlements(email: string): Promise<EntitlementsResponse> {
  return foco360Fetch(`/api/external/entitlements?email=${encodeURIComponent(email)}`);
}

export async function forgotPassword(email: string, resetUrl: string): Promise<any> {
  return foco360Fetch("/api/external/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email, resetUrl }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<any> {
  return foco360Fetch("/api/external/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
}
