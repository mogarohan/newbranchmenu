import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import { initEcho } from "../services/echo";
import { WaiterService } from "../services/waiter.service";

const Storage = {
  getItemAsync: async (key: string) => {
    try {
      if (Platform.OS === "web") return localStorage.getItem(key);
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      return null;
    }
  },
  setItemAsync: async (key: string, value: string) => {
    try {
      if (Platform.OS === "web") localStorage.setItem(key, value);
      else
        await SecureStore.setItemAsync(key, value, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
        });
    } catch (e) {}
  },
  deleteItemAsync: async (key: string) => {
    try {
      if (Platform.OS === "web") localStorage.removeItem(key);
      else await SecureStore.deleteItemAsync(key);
    } catch (e) {}
  },
};

interface WaiterUser {
  id: number;
  staff_id: string;
  email?: string; // 🔥 ADDED
  name: string;
  restaurant_id: number;
  role: string;
}
interface TableUpdatePayload {
  tableId: number;
  status: "available" | "occupied" | "cleaning";
  updatedAt: number;
}
interface AlertPayload {
  eventId: string;
  tableNumber: string | number;
  customerName: string; // 🔥 ADDED
  timestamp: number;
}

interface WaiterContextType {
  token: string | null;
  waiter: WaiterUser | null;
  isReady: boolean;
  shiftActive: boolean;
  socketConnected: boolean;
  alertsCount: number;
  ordersReadyCount: number;
  lastTableUpdate: TableUpdatePayload | null;
  lastAlertPayload: AlertPayload | null;
  login: (staffId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  toggleShift: () => Promise<void>;
  connectSocket: () => void;
  disconnectSocket: () => void;
}

const WaiterContext = createContext<WaiterContextType | undefined>(undefined);

export function WaiterProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [waiter, setWaiter] = useState<WaiterUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [shiftActive, setShiftActive] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [alertsCount, setAlertsCount] = useState(0);
  const [ordersReadyCount, setOrdersReadyCount] = useState(0);
  const [lastTableUpdate, setLastTableUpdate] =
    useState<TableUpdatePayload | null>(null);
  const [lastAlertPayload, setLastAlertPayload] = useState<AlertPayload | null>(
    null,
  );

  const echoRef = useRef<any>(null);
  const socketStateRef = useRef(false);
  const reconnectAttempts = useRef(0);
  const processedEvents = useRef<Map<string, number>>(new Map());

  const trackEvent = (eventId: string) => {
    const now = Date.now();
    if (processedEvents.current.has(eventId)) return true;
    processedEvents.current.set(eventId, now);
    if (processedEvents.current.size > 200) {
      for (const [id, time] of processedEvents.current) {
        if (now - time > 60000) processedEvents.current.delete(id);
      }
    }
    return false;
  };

  useEffect(() => {
    const loadSecureData = async () => {
      try {
        const storedToken = await Storage.getItemAsync("waiter_token");
        const storedShift = await Storage.getItemAsync("waiter_shift_active");
        const storedWaiter = await Storage.getItemAsync("waiter_data"); // 🔥 Fetch saved profile

        if (storedShift) setShiftActive(storedShift === "true");

        // 🔥 INSTANT HYDRATION: Set state instantly so the router doesn't kick the Waiter out
        if (storedToken && storedWaiter) {
          setToken(storedToken);
          setWaiter(JSON.parse(storedWaiter));
        }

        setIsReady(true); // Let the app render immediately!

        // Background Verification
        if (storedToken) {
          WaiterService.profile
            .get(storedToken)
            .then((profile) => {
              setWaiter(profile);
              Storage.setItemAsync("waiter_data", JSON.stringify(profile));
            })
            .catch((err) => {
              // Only log out if the token is completely invalid/expired (401)
              if (err?.status === 401) cleanStorage();
            });
        }
      } catch (err) {
        setIsReady(true);
      }
    };
    loadSecureData();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextAppState: AppStateStatus) => {
        if (
          nextAppState === "active" &&
          shiftActive &&
          token &&
          !socketStateRef.current
        )
          connectSocket();
      },
    );
    return () => subscription.remove();
  }, [shiftActive, token]);

  useEffect(() => {
    if (!token || !waiter?.restaurant_id || !shiftActive) {
      disconnectSocket();
      return;
    }
    connectSocket();
    return () => disconnectSocket();
  }, [token, waiter, shiftActive]);

  const connectSocket = () => {
    if (!token || !waiter?.restaurant_id) return;
    if (
      echoRef.current &&
      echoRef.current.connector?.pusher?.connection?.state === "connected"
    )
      return;

    if (echoRef.current) {
      if (echoRef.current.connector?.pusher?.connection)
        echoRef.current.connector.pusher.connection.unbind_all();
      echoRef.current.leaveAllChannels();
      echoRef.current.disconnect();
    }

    echoRef.current = initEcho(token);

    echoRef.current.connector.pusher.connection.bind(
      "state_change",
      (states: any) => {
        const isConn = states.current === "connected";
        setSocketConnected(isConn);
        socketStateRef.current = isConn;
        if (isConn) reconnectAttempts.current = 0;
      },
    );

    echoRef.current.connector.pusher.connection.bind("disconnected", () => {
      setSocketConnected(false);
      socketStateRef.current = false;
      if (shiftActive && token) {
        reconnectAttempts.current++;
        setTimeout(
          () => connectSocket(),
          Math.min(3000 * reconnectAttempts.current, 15000),
        );
      }
    });

    // 🔥 FIX 1: Removed the ".orders" suffix to correctly match the Laravel Event
    const ordersChannel = echoRef.current.private(
      `restaurant.${waiter.restaurant_id}`,
    );
    const alertsChannel = echoRef.current.private(
      `restaurant.${waiter.restaurant_id}.alerts`,
    );

    ordersChannel.listen(".OrderStatusUpdated", (event: any) => {
      const order = event.order;
      if (!order) return;

      // 🔥 FIX 2: Look for restaurant_id inside the nested order object
      if (order.restaurant_id !== waiter.restaurant_id) return;
      if (event.event_id && trackEvent(event.event_id)) return;

      // 🔥 FIX 3: Trigger a UI refresh whenever the status is pending, placed, preparing, or ready
      if (["pending", "placed", "preparing", "ready"].includes(order.status)) {
        setOrdersReadyCount((prev) => prev + 1);
      }
    });

    alertsChannel.listen(".WaiterCalled", (event: any) => {
      if (event.restaurant_id && event.restaurant_id !== waiter.restaurant_id)
        return;
      if (event.event_id && trackEvent(event.event_id)) return;

      setLastAlertPayload({
        eventId: event.event_id,
        tableNumber: event.table_number || event.table_id || "?",
        customerName: event.customer_name || "Guest",
        timestamp: Date.now(),
      });

      setAlertsCount((prev) => prev + 1);
    });

    alertsChannel.listen(".TableStatusUpdated", (event: any) => {
      if (event.restaurantId && event.restaurantId !== waiter.restaurant_id)
        return;
      setLastTableUpdate({
        tableId: event.tableId,
        status: event.status,
        updatedAt: event.updatedAt,
      });
    });
  };

  const disconnectSocket = () => {
    if (echoRef.current) {
      if (echoRef.current.connector?.pusher?.connection)
        echoRef.current.connector.pusher.connection.unbind_all();
      echoRef.current.leaveAllChannels();
      echoRef.current.disconnect();
      echoRef.current = null;
      setSocketConnected(false);
      socketStateRef.current = false;
    }
  };

  const login = async (staffId: string, password: string) => {
    const response = await WaiterService.auth.login(staffId, password);
    if (!response?.token || !response?.user)
      throw new Error("Invalid response");

    setToken(response.token);
    setWaiter(response.user);
    setShiftActive(true);

    await Storage.setItemAsync("waiter_token", response.token);
    await Storage.setItemAsync("waiter_data", JSON.stringify(response.user));
    await Storage.setItemAsync("waiter_shift_active", "true");
  };

  const cleanStorage = async () => {
    setToken(null);
    setWaiter(null);
    setShiftActive(false);
    setAlertsCount(0);
    setOrdersReadyCount(0);
    setLastTableUpdate(null);
    setLastAlertPayload(null);
    await Storage.deleteItemAsync("waiter_token");
    await Storage.deleteItemAsync("waiter_data");
    await Storage.deleteItemAsync("waiter_shift_active");
  };

  const logout = async () => {
    disconnectSocket();
    await cleanStorage();
  };

  const toggleShift = async () => {
    const newState = !shiftActive;
    setShiftActive(newState);
    await Storage.setItemAsync("waiter_shift_active", String(newState));
  };

  const contextValue = useMemo(
    () => ({
      token,
      waiter,
      isReady,
      shiftActive,
      socketConnected,
      alertsCount,
      ordersReadyCount,
      lastTableUpdate,
      lastAlertPayload,
      login,
      logout,
      toggleShift,
      connectSocket,
      disconnectSocket,
    }),
    [
      token,
      waiter,
      isReady,
      shiftActive,
      socketConnected,
      alertsCount,
      ordersReadyCount,
      lastTableUpdate,
      lastAlertPayload,
    ],
  );

  return (
    <WaiterContext.Provider value={contextValue}>
      {children}
    </WaiterContext.Provider>
  );
}

export const useWaiter = () => {
  const context = useContext(WaiterContext);
  if (!context)
    throw new Error("useWaiter must be used within a WaiterProvider");
  return context;
};
