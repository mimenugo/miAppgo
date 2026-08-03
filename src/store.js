import { useCallback, useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const readSession = (key) => {
  try {
    return globalThis.sessionStorage?.getItem(key) || "";
  } catch {
    return "";
  }
};
const writeSession = (key, value) => {
  try {
    globalThis.sessionStorage?.setItem(key, value);
  } catch {
    /* El navegador puede bloquear el almacenamiento. */
  }
};
const removeSession = (key) => {
  try {
    globalThis.sessionStorage?.removeItem(key);
  } catch {
    /* El navegador puede bloquear el almacenamiento. */
  }
};
const emptyData = {
  business: {
    brandName: "Gastro Suite",
    restaurantName: "Gastro Suite",
    branchName: "Sucursal principal",
    address: "",
    phone: "",
    email: "",
    logoUrl: "",
    timezone: "America/Tijuana",
  },
  products: [],
  orders: [],
  customers: [],
  posSettings: {
    cashPrinter: "Impresora principal de caja",
    kitchenPrinter: "Impresora de cocina",
    barPrinter: "Impresora de barra / mostrador",
    kitchenPrinterEnabled: true,
    barPrinterEnabled: true,
    cashDrawerEnabled: true,
    cashDrawerCompatible: false,
    accountHolder: "Gastro Suite",
    bank: "",
    accountNumber: "",
    clabe: "",
    cardNumber: "",
    paymentQr: "",
    openingTime: "11:00",
    closingTime: "21:00",
    slotMinutes: 30,
    prepMinutes: 30,
    slotCapacity: 4,
    usdExchangeRate: 18,
    showUsdOnTicket: true,
    shifts: [
      { name: "Matutino", start: "08:00", end: "16:00" },
      { name: "Vespertino", start: "16:00", end: "23:59" },
    ],
    stripe: {
      enabled: false,
      environment: "test",
      publishableTest: "",
      publishableLive: "",
    },
    payments: {
      transfer: true,
      qr: false,
      codi: false,
      dimo: false,
      cardTerminal: true,
    },
  },
  cashRegister: {
    open: false,
    openedAt: null,
    openingAmount: 0,
    openingOrderIds: [],
    movements: [],
    cuts: [],
    pendingPayments: [],
  },
};

async function apiRequest(path, { token, method = "GET", body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Error HTTP ${response.status}`);
  return payload;
}

export function useRestaurantStore() {
  const [data, setData] = useState(emptyData);
  const [token, setToken] = useState(() => readSession("gastro-suite-token"));
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(readSession("gastro-suite-user") || "null");
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPublic = useCallback(async () => {
    const payload = await apiRequest("/public/bootstrap");
    setData((current) => ({ ...current, ...payload }));
  }, []);
  const loadPrivate = useCallback(async (activeToken) => {
    const payload = await apiRequest("/bootstrap", { token: activeToken });
    setData((current) => ({ ...current, ...payload }));
  }, []);
  const refresh = useCallback(async () => {
    setError("");
    try {
      if (token) await loadPrivate(token);
      else await loadPublic();
    } catch (err) {
      setError(err.message);
      if (token) {
        removeSession("gastro-suite-token");
        removeSession("gastro-suite-user");
        setToken("");
        setCurrentUser(null);
        await loadPublic();
      }
    } finally {
      setLoading(false);
    }
  }, [token, loadPrivate, loadPublic]);

  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (!token) return;
    const timer = setInterval(() => loadPrivate(token).catch(() => {}), 10000);
    return () => clearInterval(timer);
  }, [token, loadPrivate]);

  const login = async (email, password) => {
    const result = await apiRequest("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    writeSession("gastro-suite-token", result.token);
    writeSession("gastro-suite-user", JSON.stringify(result.user));
    setToken(result.token);
    setCurrentUser(result.user);
    await loadPrivate(result.token);
    return result.user;
  };
  const logout = async () => {
    removeSession("gastro-suite-token");
    removeSession("gastro-suite-user");
    setToken("");
    setCurrentUser(null);
    setData(emptyData);
    await loadPublic();
  };

  const createOrder = async (payload) => {
    const order = await apiRequest("/orders", {
      token,
      method: "POST",
      body: payload,
    });
    setData((current) => ({
      ...current,
      orders: [order, ...current.orders.filter((item) => item.id !== order.id)],
    }));
    await loadPrivate(token).catch(() => {});
    return order;
  };
  const updateOrder = async (id, patch) => {
    const current = data.orders.find((item) => item.id === id);
    const order = await apiRequest(`/orders/${encodeURIComponent(current?.dbId || id)}`, { token, method: "PATCH", body: patch });
    setData((value) => ({
      ...value,
      orders: value.orders.map((item) => (item.id === id ? order : item)),
    }));
    return order;
  };
  const saveProduct = async (product) => {
    const saved = await apiRequest(product.id ? `/products/${product.id}` : "/products", { token, method: product.id ? "PUT" : "POST", body: product });
    setData((current) => ({
      ...current,
      products: product.id ? current.products.map((item) => (item.id === product.id ? saved : item)) : [...current.products, saved],
    }));
    return saved;
  };
  const savePosSettings = async (settings) => {
    const saved = await apiRequest("/settings/pos", {
      token,
      method: "PUT",
      body: settings,
    });
    setData((current) => ({ ...current, posSettings: saved }));
    return saved;
  };
  const saveBusiness = async (business) => {
    const saved = await apiRequest("/settings/business", {
      token,
      method: "PUT",
      body: business,
    });
    setData((current) => ({ ...current, business: saved }));
    return saved;
  };
  const openCashRegister = async (openingAmount, shiftName = "General") => {
    const cashRegister = await apiRequest("/cash/open", {
      token,
      method: "POST",
      body: { openingAmount, shiftName },
    });
    setData((current) => ({ ...current, cashRegister }));
    return cashRegister;
  };
  const addCashMovement = async (movement) => {
    const cashRegister = await apiRequest("/cash/movements", {
      token,
      method: "POST",
      body: movement,
    });
    setData((current) => ({ ...current, cashRegister }));
    return cashRegister;
  };
  const closeCashRegister = async (cut) => {
    const cashRegister = await apiRequest("/cash/close", {
      token,
      method: "POST",
      body: cut,
    });
    setData((current) => ({ ...current, cashRegister }));
    return cashRegister;
  };

  const createStripeCheckout = async (orderDbId) =>
    apiRequest("/payments/stripe/checkout", {
      method: "POST",
      body: { orderDbId },
    });
  return {
    ...data,
    loading,
    error,
    token,
    currentUser,
    login,
    logout,
    refresh,
    createOrder,
    updateOrder,
    saveProduct,
    savePosSettings,
    saveBusiness,
    openCashRegister,
    addCashMovement,
    closeCashRegister,
    createStripeCheckout,
  };
}
