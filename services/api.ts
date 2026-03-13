import NetInfo from "@react-native-community/netinfo";
import Constants from "expo-constants";
import { logEvent } from "../utils/logger";

const API_URL =
  Constants.expoConfig?.extra?.API_URL || process.env.EXPO_PUBLIC_API_URL;
if (!API_URL) throw new Error("Missing API_URL environment variable");

let cachedOnline = true;
NetInfo.addEventListener((state) => {
  cachedOnline = !!state.isConnected && !!state.isInternetReachable;
});

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function apiCall(
  endpoint: string,
  options: RequestInit = {},
  retries = 2,
): Promise<any> {
  if (!cachedOnline) {
    throw new ApiError("No internet connection", 0, null);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(options.headers || {}),
      },
    });

    clearTimeout(timeout);
    if (response.status === 204) return null;

    let data = null;
    try {
      data = await response.json();
    } catch (e) {}

    if (!response.ok) {
      throw new ApiError(
        data?.message || `API Error: ${response.status}`,
        response.status,
        data,
      );
    }
    return data;
  } catch (error: any) {
    if (
      retries > 0 &&
      error.name !== "AbortError" &&
      error.status !== 401 &&
      error.status !== 403 &&
      error.status !== 0
    ) {
      logEvent("WARN", `API_RETRY (${retries} left)`, endpoint);
      const delay = Math.pow(2, 3 - retries) * 500;
      await new Promise((r) => setTimeout(r, delay));
      return apiCall(endpoint, options, retries - 1);
    }
    logEvent("ERROR", "API_FAILED", { endpoint, error: error.message });
    throw error;
  }
}

export const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/json",
});
