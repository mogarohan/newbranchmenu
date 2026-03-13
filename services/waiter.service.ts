import { apiCall, authHeaders } from "./api";

export const WaiterService = {
  auth: {
    login: async (staffId: string, password: string) => {
      return apiCall("/waiter/login", {
        method: "POST",
        // 🔥 FIX: Changed 'staff_id' to 'email' to match your Laravel Controller
        body: JSON.stringify({ email: staffId, password }),
      });
    },
  },
  profile: {
    get: async (token: string) =>
      apiCall("/user", { method: "GET", headers: authHeaders(token) }),
  },
  orders: {
    ready: async (token: string) =>
      apiCall("/waiter/orders/ready", {
        method: "GET",
        headers: authHeaders(token),
      }),
    serve: async (orderId: number, token: string) =>
      apiCall(`/waiter/orders/${orderId}/serve`, {
        method: "POST",
        headers: authHeaders(token),
      }),
    acknowledge: async (orderId: number, token: string) =>
      apiCall(`/waiter/orders/${orderId}/acknowledge`, {
        method: "POST",
        headers: authHeaders(token),
      }),
  },
  tables: {
    list: async (token: string) =>
      apiCall("/waiter/tables", { headers: authHeaders(token) }),
    updateStatus: async (id: number, status: string, token: string) =>
      apiCall(`/waiter/tables/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
        headers: authHeaders(token),
      }),
  },
};
