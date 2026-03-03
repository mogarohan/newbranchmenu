import { apiCall } from "./api";

export const SessionService = {
  validateTable: async (rId: string, tId: string, token: string) => {
    return apiCall(`/qr/validate/${rId}/${tId}/${token}`);
  },

  startSession: async (
    name: string,
    mode: "new" | "join",
    rId: string,
    tId: string,
    token: string,
  ) => {
    return apiCall(`/qr/session/start/${rId}/${tId}/${token}`, {
      method: "POST",
      body: JSON.stringify({ customer_name: name, mode }),
    });
  },

  // 1. Missing endpoint properly defined
  fetchMenu: async (
    rId: string,
    tId: string,
    token: string,
    sessionToken: string,
  ) => {
    return apiCall(
      `/menu/${rId}/${tId}/${token}?session_token=${sessionToken}`,
    );
  },

  checkSessionStatus: async (
    rId: string,
    tId: string,
    token: string,
    sessionToken: string,
  ) => {
    return apiCall(
      `/menu/${rId}/${tId}/${token}?session_token=${sessionToken}`,
    );
  },

  leaveSession: async (sessionToken: string) => {
    return apiCall(`/qr/session/leave`, {
      method: "POST",
      body: JSON.stringify({ session_token: sessionToken }),
    });
  },

  // 2. Authentication token added to Host Endpoints
  getPendingRequests: async (tableId: string, sessionToken: string) => {
    return apiCall(
      `/table/${tableId}/pending-requests?session_token=${sessionToken}`,
    );
  },

  respondToRequest: async (
    sessionId: number,
    action: "approve" | "reject",
    sessionToken: string,
  ) => {
    return apiCall(`/session/${sessionId}/respond`, {
      method: "POST",
      body: JSON.stringify({ action, session_token: sessionToken }), // Secure the action
    });
  },
};
