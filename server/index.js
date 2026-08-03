import "dotenv/config";
import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Stripe from "stripe";
import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const rootDirectory = dirname(fileURLToPath(import.meta.url));
const uploadDirectory = join(rootDirectory, "uploads");
const publicDirectory = join(rootDirectory, "..", "dist");
await mkdir(uploadDirectory, { recursive: true });

const pool = mysql.createPool({
  host: process.env.DB_HOST || process.env.MYSQLHOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
  user: process.env.DB_USER || process.env.MYSQLUSER || "root",
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || "",
  database: process.env.DB_NAME || process.env.MYSQLDATABASE || "gastro_suite",
  waitForConnections: true,
  connectionLimit: 10,
  timezone: "Z",
  decimalNumbers: true,
  charset: "utf8mb4",
});

const app = express();
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:4174")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
if (process.env.RAILWAY_PUBLIC_DOMAIN) allowedOrigins.push(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
app.use(
  cors({
    origin: (origin, callback) => (!origin || allowedOrigins.includes(origin) ? callback(null, true) : callback(new Error("Origen no permitido por CORS."))),
  }),
);
const stripeFor = (environment) => {
  const live = environment === "production";
  const key = live ? process.env.STRIPE_LIVE_RESTRICTED_KEY || process.env.STRIPE_LIVE_SECRET_KEY : process.env.STRIPE_TEST_RESTRICTED_KEY || process.env.STRIPE_TEST_SECRET_KEY;
  if (!key) throw new Error(`Falta configurar la llave privada de Stripe para ${live ? "produccion" : "pruebas"} en las variables del servidor.`);
  return new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
};
app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  let event = null;
  for (const [environment, secret] of [
    ["production", process.env.STRIPE_LIVE_WEBHOOK_SECRET],
    ["test", process.env.STRIPE_TEST_WEBHOOK_SECRET],
  ]) {
    if (!secret) continue;
    try {
      event = stripeFor(environment).webhooks.constructEvent(req.body, req.headers["stripe-signature"], secret);
      break;
    } catch {
      /* Probar el otro ambiente. */
    }
  }
  if (!event) return res.status(400).send("Firma de Stripe no valida.");
  try {
    if (event.type === "checkout.session.completed" && event.data.object.payment_status === "paid") {
      const session = event.data.object,
        orderId = Number(session.metadata?.order_id);
      if (orderId) {
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();
          await connection.execute(`UPDATE payments SET status='paid',amount_received=?,paid_at=UTC_TIMESTAMP(3),external_transaction_id=? WHERE order_id=?`, [Number(session.amount_total || 0) / 100, session.id, orderId]);
          await connection.execute(`UPDATE orders SET status_code=IF(status_code='pending_payment','preparing',status_code),version=version+1 WHERE id=?`, [orderId]);
          await connection.execute(`INSERT INTO webhook_inbox(provider,external_event_id,signature_verified,payload,status,processed_at) VALUES('stripe',?,TRUE,?,'processed',UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE status='processed',processed_at=UTC_TIMESTAMP(3)`, [event.id, JSON.stringify(event)]);
          await connection.commit();
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      }
    }
    res.json({ received: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No fue posible procesar el webhook." });
  }
});
app.use(express.json({ limit: "5mb" }));
app.use("/uploads", express.static(uploadDirectory));

const STATUS_TO_DB = {
  Recibido: "pending",
  "Pendiente de pago": "pending_payment",
  Confirmado: "paid",
  "En preparación": "preparing",
  "Listo para recoger": "ready",
  "Listo para enviar": "ready",
  "Asignado a repartidor": "assigned",
  "En ruta": "en_route",
  Entregado: "delivered",
  Cancelado: "cancelled",
  Nuevo: "pending",
  Pagado: "paid",
  Listo: "ready",
  Asignado: "assigned",
};
const statusToUi = (order) =>
  ({
    pending: "Recibido",
    pending_payment: "Pendiente de pago",
    paid: "Confirmado",
    preparing: "En preparación",
    ready: order.fulfillment_type === "delivery" ? "Listo para enviar" : "Listo para recoger",
    assigned: "Asignado a repartidor",
    en_route: "En ruta",
    delivered: "Entregado",
    cancelled: "Cancelado",
  })[order.status_code] || order.status_code;
const PAYMENT_TO_UI = {
  cash: "Efectivo",
  transfer: "Transferencia / Depósito",
  stripe: "Stripe en línea",
  card_terminal: "Tarjeta en caja",
  qr: "Pago con QR",
  codi: "CoDi",
  dimo: "DiMo",
  mercado_pago: "Mercado Pago",
  paypal: "PayPal",
};
const PAYMENT_TO_DB = Object.fromEntries(Object.entries(PAYMENT_TO_UI).map(([key, value]) => [value, key]));
const CATEGORY_MEDIA = {
  Tacos: ["🌮", "coral"],
  Hamburguesas: ["🍔", "amber"],
  Pizzas: ["🍕", "red"],
  Especiales: ["🍽️", "green"],
  Bebidas: ["🥤", "pink"],
  Postres: ["🍮", "gold"],
};
const JWT_SECRET = process.env.JWT_SECRET || "local-development-secret-change-me";

const safeJson = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};
const dateInZone = (value, timeZone = "America/Tijuana") =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
const authHeader = (req) => (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : "");
const authenticate = (req, res, next) => {
  try {
    req.auth = jwt.verify(authHeader(req), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Sesión requerida o vencida." });
  }
};
const allow =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.auth?.role) ? next() : res.status(403).json({ error: "No tienes permiso para esta operación." });
const audit = async (connection, { businessId, branchId, userId, action, entityType, entityId, oldValues = null, newValues = null }) =>
  connection.execute(
    `INSERT INTO audit_logs(business_id,branch_id,actor_user_id,action,entity_type,entity_id,old_values,new_values)
   VALUES(?,?,?,?,?,?,?,?)`,
    [businessId, branchId, userId, action, entityType, String(entityId), oldValues ? JSON.stringify(oldValues) : null, newValues ? JSON.stringify(newValues) : null],
  );

async function businessData() {
  const [[row]] = await pool.query(`SELECT b.id businessId,b.name brandName,b.legal_name restaurantName,b.logo_url logoUrl,b.phone,b.email,b.timezone,b.currency,
    br.id branchId,br.name branchName,br.address_line1 address,br.city,br.state,br.phone branchPhone,br.email branchEmail
    FROM businesses b JOIN branches br ON br.business_id=b.id WHERE b.status='active' AND br.status='active' ORDER BY br.id LIMIT 1`);
  if (!row) throw new Error("No existe un negocio activo.");
  return {
    ...row,
    restaurantName: row.restaurantName || row.brandName,
    phone: row.branchPhone || row.phone,
    email: row.branchEmail || row.email,
  };
}

async function productsData(baseUrl = "") {
  const [rows] = await pool.query(`SELECT p.id,p.name,p.description,p.price,p.image_url,p.available_for_delivery,p.active,c.name category,
    GROUP_CONCAT(a.code ORDER BY a.sort_order) area_codes
    FROM products p LEFT JOIN categories c ON c.id=p.category_id
    LEFT JOIN product_preparation_areas ppa ON ppa.product_id=p.id LEFT JOIN preparation_areas a ON a.id=ppa.preparation_area_id
    GROUP BY p.id,c.name ORDER BY c.sort_order,p.id`);
  return rows.map((row) => {
    const areas = String(row.area_codes || "kitchen").split(",");
    const hasKitchen = areas.includes("kitchen");
    const hasBar = areas.some((area) => ["bar", "drinks", "dispatch"].includes(area));
    const [emoji, tone] = CATEGORY_MEDIA[row.category] || ["🍽️", "amber"];
    return {
      id: row.id,
      name: row.name,
      desc: row.description || "",
      price: Number(row.price),
      category: row.category || "Especiales",
      station: hasKitchen && hasBar ? "Ambas" : hasKitchen ? "Cocina" : "Barra",
      deliveryEnabled: Boolean(row.available_for_delivery),
      image: row.image_url ? (row.image_url.startsWith("/uploads/") ? `${baseUrl}${row.image_url}` : row.image_url) : "",
      emoji,
      tone,
      active: Boolean(row.active),
    };
  });
}

async function ordersData() {
  const business = await businessData(),
    timeZone = business.timezone || "America/Tijuana";
  const [orders] = await pool.query(`SELECT o.*,p.payment_method_code,p.status payment_status,p.amount_received,
    CONCAT_WS(' ',du.full_name) driver_name
    FROM orders o LEFT JOIN payments p ON p.order_id=o.id
    LEFT JOIN delivery_assignments da ON da.id=(
      SELECT da2.id FROM delivery_assignments da2
      WHERE da2.order_id=o.id AND da2.status NOT IN ('cancelled','rejected')
      ORDER BY da2.id DESC LIMIT 1
    )
    LEFT JOIN drivers d ON d.id=da.driver_id LEFT JOIN users du ON du.id=d.user_id ORDER BY o.created_at DESC`);
  if (!orders.length) return [];
  const ids = orders.map((order) => order.id);
  const [items] = await pool.query(
    `SELECT oi.*,p.id product_id,c.name category,GROUP_CONCAT(DISTINCT a.code) area_codes
    FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id LEFT JOIN categories c ON c.id=p.category_id
    LEFT JOIN product_preparation_areas ppa ON ppa.product_id=p.id LEFT JOIN preparation_areas a ON a.id=ppa.preparation_area_id
    WHERE oi.order_id IN (?) GROUP BY oi.id,p.id,c.name`,
    [ids],
  );
  const [tickets] = await pool.query(`SELECT pt.order_id,a.code,pt.status FROM production_tickets pt JOIN preparation_areas a ON a.id=pt.preparation_area_id WHERE pt.order_id IN (?)`, [ids]);
  const itemMap = new Map(),
    ticketMap = new Map();
  items.forEach((item) => {
    const areas = String(item.area_codes || "kitchen").split(",");
    const line = {
      id: item.product_id,
      name: item.product_name,
      qty: Number(item.quantity),
      price: Number(item.unit_price),
      note: item.preparation_notes || "",
      category: item.category,
      station: areas.includes("kitchen") && areas.some((a) => a !== "kitchen") ? "Ambas" : areas.includes("kitchen") ? "Cocina" : "Barra",
    };
    itemMap.set(item.order_id, [...(itemMap.get(item.order_id) || []), line]);
  });
  tickets.forEach((ticket) =>
    ticketMap.set(ticket.order_id, {
      ...(ticketMap.get(ticket.order_id) || {}),
      [ticket.code]: ticket.status,
    }),
  );
  return orders.map((order) => {
    const address = safeJson(order.delivery_address_snapshot),
      statuses = ticketMap.get(order.id) || {};
    return {
      id: order.ticket_number || order.folio,
      folio: order.folio,
      dbId: order.id,
      customer: order.customer_name,
      phone: order.customer_phone || "Mostrador",
      address: address.address || "",
      coordinates: address.latitude && address.longitude ? [Number(address.latitude), Number(address.longitude)] : undefined,
      reference: address.references || "",
      serviceType: order.fulfillment_type === "delivery" ? "Domicilio" : "Recoger en restaurante",
      lines: itemMap.get(order.id) || [],
      subtotal: Number(order.subtotal),
      delivery: Number(order.delivery_fee),
      total: Number(order.total),
      payment: PAYMENT_TO_UI[order.payment_method_code] || order.payment_method_code || "Pendiente",
      paid: order.payment_status === "paid",
      paymentStatus: order.payment_status === "paid" ? "Pagado" : order.payment_status === "pending_validation" ? "Pendiente de validar" : "Pendiente de pago",
      status: statusToUi(order),
      createdAt: new Intl.DateTimeFormat("es-MX", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
      }).format(order.created_at),
      createdTimestamp: new Date(order.created_at).getTime(),
      createdDate: dateInZone(order.created_at, timeZone),
      createdHour: Number(
        new Intl.DateTimeFormat("en-US", {
          timeZone,
          hour: "numeric",
          hour12: false,
        }).format(order.created_at),
      ),
      scheduledDate: order.scheduled_for ? dateInZone(order.scheduled_for, timeZone) : "",
      scheduledTime: order.scheduled_for
        ? new Intl.DateTimeFormat("es-MX", {
            timeZone,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(order.scheduled_for)
        : "",
      preparationStatus: {
        Cocina: statuses.kitchen === "ready" ? "Listo" : statuses.kitchen ? "Preparando" : "No aplica",
        Barra: ["ready"].includes(statuses.bar) || ["ready"].includes(statuses.drinks) ? "Listo" : statuses.bar || statuses.drinks ? "Preparando" : "No aplica",
      },
      barStatus: statuses.bar === "ready" || statuses.drinks === "ready" ? "Preparado" : "Pendiente",
      driver: order.driver_name || "",
    };
  });
}

async function customersData() {
  const [rows] = await pool.query(`SELECT c.id,c.full_name name,c.phone,COALESCE(a.address_line1,'') address,
    COUNT(DISTINCT o.id) orders,COALESCE(SUM(o.total),0) total
    FROM customers c LEFT JOIN customer_addresses a ON a.customer_id=c.id AND a.is_default=TRUE
    LEFT JOIN orders o ON o.customer_id=c.id GROUP BY c.id,a.address_line1 ORDER BY c.full_name`);
  return rows.map((row) => ({ ...row, total: Number(row.total) }));
}

async function cashData() {
  const business = await businessData(),
    timeZone = business.timezone || "America/Tijuana";
  const [[shift]] = await pool.query(`SELECT * FROM cash_register_shifts ORDER BY (status='open') DESC,id DESC LIMIT 1`);
  const [pendingPayments] = await pool.query(`SELECT o.id,o.ticket_number id,o.customer_name customer,o.total FROM orders o LEFT JOIN payments p ON p.order_id=o.id WHERE o.business_date=? AND o.status_code<>'cancelled' AND COALESCE(p.status,'pending')<>'paid' ORDER BY o.created_at`, [dateInZone(new Date(), timeZone)]);
  if (!shift)
    return {
      open: false,
      openedAt: null,
      openingAmount: 0,
      openingOrderIds: [],
      movements: [],
      cuts: [],
      pendingPayments,
    };
  const [movements] = await pool.query(`SELECT id,movement_type,amount,concept,created_at FROM cash_movements WHERE cash_register_shift_id=? ORDER BY created_at DESC`, [shift.id]);
  const [cuts] = await pool.query(`SELECT id,opening_amount openingAmount,expected_amount expected,counted_amount counted,difference_amount difference,closing_notes note,closed_at FROM cash_register_shifts WHERE status='closed' ORDER BY closed_at DESC LIMIT 30`);
  return {
    open: shift.status === "open",
    shiftId: shift.id,
    shiftName: shift.shift_name,
    businessDate: shift.business_date,
    openedAt: shift.opened_at,
    openingAmount: Number(shift.opening_amount),
    openingOrderIds: [],
    pendingPayments,
    movements: movements.map((item) => ({
      id: item.id,
      type: item.movement_type === "withdrawal" ? "Retiro" : "Entrada",
      amount: Number(item.amount),
      concept: item.concept,
      createdAt: new Intl.DateTimeFormat("es-MX", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
      }).format(item.created_at),
    })),
    cuts: cuts.map((cut) => ({
      ...cut,
      closedAt: cut.closed_at
        ? new Intl.DateTimeFormat("es-MX", {
            timeZone,
            dateStyle: "short",
            timeStyle: "short",
          }).format(cut.closed_at)
        : "",
    })),
  };
}

async function settingsData() {
  const [[row]] = await pool.query(`SELECT setting_value FROM app_settings WHERE setting_key='pos' ORDER BY id DESC LIMIT 1`);
  return safeJson(row?.setting_value);
}

async function bootstrap(baseUrl, includePrivate) {
  const [business, products] = await Promise.all([businessData(), productsData(baseUrl)]);
  if (!includePrivate) return { business, products };
  const [orders, customers, cashRegister, posSettings] = await Promise.all([ordersData(), customersData(), cashData(), settingsData()]);
  return { business, products, orders, customers, cashRegister, posSettings };
}

async function saveImage(dataUrl) {
  if (!dataUrl?.startsWith("data:image/")) return dataUrl || "";
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
  if (!match) throw new Error("Formato de imagen no permitido.");
  const extension = match[1] === "jpeg" ? "jpg" : match[1],
    fileName = `${randomUUID()}.${extension}`;
  await writeFile(join(uploadDirectory, fileName), Buffer.from(match[2], "base64"));
  return `/uploads/${fileName}`;
}

app.get("/api/health", (req, res) => res.status(200).json({ ok: true, service: "gastro-suite-api" }));
app.get("/api/readiness", async (req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      ok: true,
      database: process.env.DB_NAME || process.env.MYSQLDATABASE || "gastro_suite",
    });
  } catch (error) {
    next(error);
  }
});
app.get("/api/public/bootstrap", async (req, res, next) => {
  try {
    res.json(await bootstrap(`${req.protocol}://${req.get("host")}`, false));
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const [[user]] = await pool.query(
      `SELECT u.id,u.full_name,u.email,u.password_hash,r.code role FROM users u
    JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.email=? AND u.status='active' LIMIT 1`,
      [email],
    );
    if (!user || !(await bcrypt.compare(password || "", user.password_hash))) return res.status(401).json({ error: "Correo o contraseña incorrectos." });
    await pool.execute("UPDATE users SET last_login_at=UTC_TIMESTAMP(3) WHERE id=?", [user.id]);
    const token = jwt.sign({ sub: user.id, role: user.role, name: user.full_name }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "8h" });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/bootstrap", authenticate, async (req, res, next) => {
  try {
    res.json(await bootstrap(`${req.protocol}://${req.get("host")}`, true));
  } catch (error) {
    next(error);
  }
});

app.post("/api/orders", async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const payload = req.body,
      business = await businessData(),
      businessDate = dateInZone(new Date(), business.timezone);
    const [[maxRow]] = await connection.query(`SELECT COALESCE(MAX(daily_sequence),0)+1 dailySequence FROM orders WHERE branch_id=? AND business_date=? FOR UPDATE`, [business.branchId, businessDate]);
    const dailySequence = Number(maxRow.dailySequence),
      ticketNumber = `FG-${String(dailySequence).padStart(2, "0")}`,
      folio = `FG-${businessDate.replaceAll("-", "")}-${String(dailySequence).padStart(4, "0")}`;
    let customerId = null;
    if (payload.phone && payload.phone !== "Mostrador") {
      const [[known]] = await connection.query("SELECT id FROM customers WHERE business_id=? AND phone=?", [business.businessId, payload.phone]);
      if (known) customerId = known.id;
      else {
        const [created] = await connection.execute("INSERT INTO customers(business_id,public_id,full_name,phone,privacy_accepted_at) VALUES(?,UUID(),?,?,UTC_TIMESTAMP(3))", [business.businessId, payload.customer, payload.phone]);
        customerId = created.insertId;
      }
      if (payload.serviceType === "Domicilio" && payload.address) {
        await connection.execute(
          `INSERT INTO customer_addresses(customer_id,label,address_line1,city,state,references_text,is_default)
        SELECT ?,'Casa',?,'Tijuana','Baja California',?,TRUE WHERE NOT EXISTS(SELECT 1 FROM customer_addresses WHERE customer_id=? AND address_line1=?)`,
          [customerId, payload.address, payload.reference || "", customerId, payload.address],
        );
      }
    }
    const paid = Boolean(payload.paid),
      hasPrep = payload.lines?.length > 0,
      method = PAYMENT_TO_DB[payload.payment] || "cash",
      status = paid && hasPrep ? "preparing" : paid ? "paid" : method === "stripe" ? "pending_payment" : hasPrep ? "preparing" : "pending";
    const scheduledFor = payload.scheduledDate && payload.scheduledTime ? `${payload.scheduledDate} ${payload.scheduledTime}:00` : null;
    const address =
      payload.serviceType === "Domicilio"
        ? JSON.stringify({
            address: payload.address || "",
            references: payload.reference || "",
            latitude: payload.coordinates?.[0],
            longitude: payload.coordinates?.[1],
          })
        : null;
    const [created] = await connection.execute(
      `INSERT INTO orders(public_id,folio,ticket_number,business_date,daily_sequence,business_id,branch_id,customer_id,source,fulfillment_type,status_code,customer_name,customer_phone,delivery_address_snapshot,scheduled_for,subtotal,delivery_fee,total,customer_notes)
      VALUES(UUID(),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [folio, ticketNumber, businessDate, dailySequence, business.businessId, business.branchId, customerId, payload.source || "pos", payload.serviceType === "Domicilio" ? "delivery" : "pickup", status, payload.customer, payload.phone || null, address, scheduledFor, payload.subtotal || payload.total || 0, payload.delivery || 0, payload.total || 0, payload.notes || null],
    );
    const orderId = created.insertId,
      areaItems = new Map();
    for (const line of payload.lines || []) {
      const [[product]] = await connection.query(`SELECT p.id,p.sku,p.name,p.price,GROUP_CONCAT(a.id) area_ids FROM products p LEFT JOIN product_preparation_areas ppa ON ppa.product_id=p.id LEFT JOIN preparation_areas a ON a.id=ppa.preparation_area_id WHERE p.id=? GROUP BY p.id`, [line.id]);
      if (!product) throw new Error(`Producto ${line.id} no encontrado.`);
      const [itemResult] = await connection.execute(`INSERT INTO order_items(order_id,product_id,product_name,sku,quantity,unit_price,line_total,preparation_notes) VALUES(?,?,?,?,?,?,?,?)`, [orderId, product.id, product.name, product.sku, line.qty, line.price, line.qty * line.price, line.note || null]);
      for (const areaId of String(product.area_ids || "")
        .split(",")
        .filter(Boolean))
        areaItems.set(areaId, [...(areaItems.get(areaId) || []), { itemId: itemResult.insertId, qty: line.qty }]);
    }
    for (const [areaId, items] of areaItems) {
      const [ticket] = await connection.execute("INSERT INTO production_tickets(order_id,preparation_area_id,status) VALUES(?,?,?)", [orderId, areaId, paid ? "pending" : "pending"]);
      for (const item of items) await connection.execute("INSERT INTO production_ticket_items(production_ticket_id,order_item_id,quantity) VALUES(?,?,?)", [ticket.insertId, item.itemId, item.qty]);
    }
    const paymentStatus = paid ? "paid" : ["transfer", "qr", "codi", "dimo"].includes(method) ? "pending_validation" : "pending";
    await connection.execute(`INSERT INTO payments(public_id,order_id,payment_method_code,status,amount_expected,amount_received,currency,paid_at,reference,proof_file_url) VALUES(UUID(),?,?,?,?,?,'MXN',?,?,?)`, [orderId, method, paymentStatus, payload.total || 0, paid ? payload.total || 0 : 0, paid ? new Date() : null, payload.paymentReference || null, payload.paymentProof || null]);
    await connection.execute("INSERT INTO order_status_history(order_id,to_status_code,notes) VALUES(?,?,?)", [orderId, status, "Pedido creado"]);
    await audit(connection, {
      businessId: business.businessId,
      branchId: business.branchId,
      userId: req.auth?.sub || null,
      action: "order.created",
      entityType: "order",
      entityId: orderId,
      newValues: { folio, total: payload.total, status },
    });
    await connection.commit();
    res.status(201).json((await ordersData()).find((order) => order.dbId === orderId));
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.patch("/api/orders/:folio", authenticate, allow("administrator", "cashier", "kitchen", "bar", "driver", "supervisor"), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const business = await businessData();
    const [[order]] = await connection.query("SELECT * FROM orders WHERE id=? OR folio=? OR ticket_number=? ORDER BY id DESC LIMIT 1 FOR UPDATE", [req.params.folio, req.params.folio, req.params.folio]);
    if (!order) {
      await connection.rollback();
      return res.status(404).json({ error: "Pedido no encontrado." });
    }
    const patch = req.body,
      dbStatus = patch.preparationStatus ? null : STATUS_TO_DB[patch.status] || patch.status;
    const allowedTransitions = {
      pending: ["pending_payment", "paid", "preparing", "cancelled"],
      pending_payment: ["paid", "preparing", "cancelled"],
      paid: ["preparing", "ready", "cancelled"],
      preparing: ["ready", "cancelled"],
      ready: ["assigned", "delivered", "cancelled"],
      assigned: ["ready", "en_route", "cancelled"],
      en_route: ["delivered", "cancelled"],
      delivered: [],
      cancelled: [],
    };
    if (dbStatus && dbStatus !== order.status_code && !allowedTransitions[order.status_code]?.includes(dbStatus)) {
      await connection.rollback();
      return res.status(409).json({ error: `Transición no permitida: ${statusToUi(order)} → ${patch.status}. Actualiza la pantalla antes de continuar.` });
    }
    if (dbStatus && dbStatus !== order.status_code) {
      await connection.execute("UPDATE orders SET status_code=?,version=version+1 WHERE id=?", [dbStatus, order.id]);
      await connection.execute("INSERT INTO order_status_history(order_id,from_status_code,to_status_code,changed_by_user_id,notes) VALUES(?,?,?,?,?)", [order.id, order.status_code, dbStatus, req.auth.sub, "Actualizado desde operación"]);
    }
    if (patch.preparationStatus) {
      for (const [uiArea, uiStatus] of Object.entries(patch.preparationStatus)) {
        const codes = uiArea === "Cocina" ? ["kitchen"] : ["bar", "drinks", "dispatch"];
        await connection.query(`UPDATE production_tickets pt JOIN preparation_areas a ON a.id=pt.preparation_area_id SET pt.status=?,pt.accepted_by_user_id=?,pt.accepted_at=COALESCE(pt.accepted_at,UTC_TIMESTAMP(3)),pt.completed_at=IF(?='ready',UTC_TIMESTAMP(3),pt.completed_at) WHERE pt.order_id=? AND a.code IN (?)`, [uiStatus === "Listo" ? "ready" : uiStatus === "Preparando" ? "preparing" : "pending", req.auth.sub, uiStatus === "Listo" ? "ready" : "pending", order.id, codes]);
      }
      const [[remaining]] = await connection.query("SELECT COUNT(*) pending FROM production_tickets WHERE order_id=? AND status<>'ready'", [order.id]);
      if (Number(remaining.pending) === 0) {
        await connection.execute("UPDATE orders SET status_code='ready',version=version+1 WHERE id=?", [order.id]);
      } else await connection.execute("UPDATE orders SET status_code='preparing',version=version+1 WHERE id=? AND status_code NOT IN ('cancelled','delivered')", [order.id]);
    }
    if ("driver" in patch) {
      if (patch.driver) {
        const [[driver]] = await connection.query(`SELECT d.id FROM drivers d JOIN users u ON u.id=d.user_id WHERE u.full_name=? LIMIT 1`, [patch.driver]);
        if (driver) await connection.execute(`INSERT INTO delivery_assignments(order_id,driver_id,assigned_by_user_id,status) VALUES(?,?,?,'assigned') ON DUPLICATE KEY UPDATE driver_id=VALUES(driver_id),assigned_by_user_id=VALUES(assigned_by_user_id),status='assigned'`, [order.id, driver.id, req.auth.sub]);
      } else await connection.execute("UPDATE delivery_assignments SET status='cancelled' WHERE order_id=? AND status<>'delivered'", [order.id]);
    }
    if (dbStatus === "en_route") {
      await connection.execute("UPDATE delivery_assignments SET status='en_route',route_started_at=COALESCE(route_started_at,UTC_TIMESTAMP(3)) WHERE order_id=? AND status IN ('assigned','accepted') ORDER BY id DESC LIMIT 1", [order.id]);
    }
    if (dbStatus === "delivered") {
      await connection.execute("UPDATE delivery_assignments SET status='delivered',delivered_at=COALESCE(delivered_at,UTC_TIMESTAMP(3)) WHERE order_id=? AND status IN ('assigned','accepted','en_route') ORDER BY id DESC LIMIT 1", [order.id]);
      if (patch.paid === true) {
        await connection.execute("UPDATE payments SET status='paid',amount_received=amount_expected,paid_at=COALESCE(paid_at,UTC_TIMESTAMP(3)),validated_by_user_id=?,validated_at=COALESCE(validated_at,UTC_TIMESTAMP(3)) WHERE order_id=? AND payment_method_code='cash' AND status<>'paid'", [req.auth.sub, order.id]);
      }
    }
    await audit(connection, {
      businessId: business.businessId,
      branchId: business.branchId,
      userId: req.auth.sub,
      action: "order.updated",
      entityType: "order",
      entityId: order.id,
      oldValues: { status: order.status_code },
      newValues: patch,
    });
    await connection.commit();
    res.json((await ordersData()).find((item) => item.dbId === order.id));
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.post("/api/products", authenticate, allow("administrator"), async (req, res, next) => {
  try {
    const business = await businessData(),
      product = req.body,
      imageUrl = await saveImage(product.image);
    const [[category]] = await pool.query("SELECT id FROM categories WHERE business_id=? AND name=?", [business.businessId, product.category]);
    const [created] = await pool.execute(`INSERT INTO products(business_id,category_id,public_id,sku,name,description,price,image_url,available_for_delivery,active) VALUES(?,?,UUID(),?,?,?,?,?,?,?)`, [business.businessId, category?.id || null, `CUS-${Date.now()}`, product.name, product.desc || "", Number(product.price), imageUrl, product.deliveryEnabled !== false, product.active !== false]);
    await setProductArea(created.insertId, product.station);
    res.status(201).json((await productsData(`${req.protocol}://${req.get("host")}`)).find((item) => item.id === created.insertId));
  } catch (error) {
    next(error);
  }
});
app.put("/api/products/:id", authenticate, allow("administrator"), async (req, res, next) => {
  try {
    const business = await businessData(),
      product = req.body,
      imageUrl = await saveImage(product.image);
    const [[category]] = await pool.query("SELECT id FROM categories WHERE business_id=? AND name=?", [business.businessId, product.category]);
    await pool.execute(`UPDATE products SET category_id=?,name=?,description=?,price=?,image_url=?,available_for_delivery=?,active=? WHERE id=? AND business_id=?`, [category?.id || null, product.name, product.desc || "", Number(product.price), imageUrl || null, product.deliveryEnabled !== false, product.active !== false, req.params.id, business.businessId]);
    await setProductArea(req.params.id, product.station);
    res.json((await productsData(`${req.protocol}://${req.get("host")}`)).find((item) => String(item.id) === String(req.params.id)));
  } catch (error) {
    next(error);
  }
});

async function setProductArea(productId, station) {
  const codes = station === "Ambas" ? ["kitchen", "bar"] : station === "Cocina" ? ["kitchen"] : ["bar"];
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("DELETE FROM product_preparation_areas WHERE product_id=?", [productId]);
    const [areas] = await connection.query("SELECT id FROM preparation_areas WHERE code IN (?)", [codes]);
    for (const area of areas) await connection.execute("INSERT INTO product_preparation_areas(product_id,preparation_area_id) VALUES(?,?)", [productId, area.id]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

app.put("/api/settings/pos", authenticate, allow("administrator", "cashier"), async (req, res, next) => {
  try {
    const business = await businessData();
    await pool.execute(`INSERT INTO app_settings(business_id,branch_id,setting_key,setting_value,updated_by_user_id) VALUES(?,?,'pos',?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_by_user_id=VALUES(updated_by_user_id)`, [business.businessId, business.branchId, JSON.stringify(req.body), req.auth.sub]);
    res.json(req.body);
  } catch (error) {
    next(error);
  }
});

app.post("/api/payments/stripe/checkout", async (req, res, next) => {
  try {
    const orderId = Number(req.body.orderDbId),
      settings = await settingsData(),
      stripeSettings = settings.stripe || {};
    if (!stripeSettings.enabled) return res.status(409).json({ error: "Stripe no está habilitado." });
    const [[order]] = await pool.query("SELECT id,folio,ticket_number,total,currency,customer_name,customer_phone FROM orders WHERE id=?", [orderId]);
    if (!order) return res.status(404).json({ error: "Pedido no encontrado." });
    const origin = req.headers.origin || `${req.protocol}://${req.get("host")}`,
      client = stripeFor(stripeSettings.environment || "test");
    const session = await client.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: String(order.currency || "MXN").toLowerCase(),
            unit_amount: Math.round(Number(order.total) * 100),
            product_data: {
              name: `Pedido ${order.ticket_number}`,
              description: "Pedido de restaurante",
            },
          },
        },
      ],
      customer_creation: "always",
      metadata: { order_id: String(order.id), folio: order.folio },
      success_url: `${origin}/?pago=exitoso&pedido=${encodeURIComponent(order.ticket_number)}`,
      cancel_url: `${origin}/?pago=cancelado&pedido=${encodeURIComponent(order.ticket_number)}`,
    });
    await pool.execute("UPDATE payments SET external_transaction_id=? WHERE order_id=?", [session.id, order.id]);
    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    next(error);
  }
});

app.get("/api/settings/business", authenticate, allow("administrator"), async (req, res, next) => {
  try {
    res.json(await businessData());
  } catch (error) {
    next(error);
  }
});
app.put("/api/settings/business", authenticate, allow("administrator"), async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const current = await businessData(),
      payload = req.body,
      logoUrl = await saveImage(payload.logo || payload.logoUrl);
    await connection.execute("UPDATE businesses SET name=?,legal_name=?,logo_url=?,phone=?,email=?,timezone=? WHERE id=?", [payload.brandName || current.brandName, payload.restaurantName || current.restaurantName, logoUrl || current.logoUrl, payload.phone || "", payload.email || "", payload.timezone || current.timezone, current.businessId]);
    await connection.execute("UPDATE branches SET name=?,address_line1=?,phone=?,email=? WHERE id=?", [payload.branchName || current.branchName, payload.address || current.address, payload.phone || "", payload.email || "", current.branchId]);
    await audit(connection, {
      businessId: current.businessId,
      branchId: current.branchId,
      userId: req.auth.sub,
      action: "business.updated",
      entityType: "business",
      entityId: current.businessId,
      oldValues: current,
      newValues: { ...payload, logo: payload.logo ? "[imagen]" : undefined },
    });
    await connection.commit();
    res.json(await businessData());
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

app.post("/api/cash/open", authenticate, allow("administrator", "cashier"), async (req, res, next) => {
  try {
    const business = await businessData();
    const [[open]] = await pool.query("SELECT id FROM cash_register_shifts WHERE branch_id=? AND status='open'", [business.branchId]);
    if (open) return res.status(409).json({ error: "Ya existe un turno de caja abierto." });
    await pool.execute(`INSERT INTO cash_register_shifts(branch_id,shift_name,business_date,opened_by_user_id,opening_amount,status) VALUES(?,?,?,?,?,'open')`, [business.branchId, req.body.shiftName || "General", dateInZone(new Date(), business.timezone), req.auth.sub, Number(req.body.openingAmount)]);
    res.json(await cashData());
  } catch (error) {
    next(error);
  }
});
app.post("/api/cash/movements", authenticate, allow("administrator", "cashier"), async (req, res, next) => {
  try {
    const [[shift]] = await pool.query("SELECT id FROM cash_register_shifts WHERE status='open' ORDER BY id DESC LIMIT 1");
    if (!shift) return res.status(409).json({ error: "No hay una caja abierta." });
    await pool.execute("INSERT INTO cash_movements(cash_register_shift_id,user_id,movement_type,amount,concept) VALUES(?,?,?,?,?)", [shift.id, req.auth.sub, req.body.type === "Retiro" ? "withdrawal" : "income", Number(req.body.amount), req.body.concept]);
    res.json(await cashData());
  } catch (error) {
    next(error);
  }
});
app.post("/api/cash/close", authenticate, allow("administrator", "cashier"), async (req, res, next) => {
  try {
    const [[shift]] = await pool.query("SELECT id,business_date FROM cash_register_shifts WHERE status='open' ORDER BY id DESC LIMIT 1");
    if (!shift) return res.status(409).json({ error: "No hay una caja abierta." });
    const [pending] = await pool.query(`SELECT o.ticket_number FROM orders o LEFT JOIN payments p ON p.order_id=o.id WHERE o.business_date=? AND o.status_code<>'cancelled' AND COALESCE(p.status,'pending')<>'paid'`, [shift.business_date]);
    if (pending.length)
      return res.status(409).json({
        error: `No se puede cerrar: existen ${pending.length} pedido(s) sin cobrar (${pending.map((item) => item.ticket_number).join(", ")}).`,
      });
    await pool.execute(`UPDATE cash_register_shifts SET status='closed',close_type=?,closed_by_user_id=?,expected_amount=?,counted_amount=?,difference_amount=?,closing_notes=?,closed_at=UTC_TIMESTAMP(3) WHERE id=?`, [req.body.closeType === "Z" ? "Z" : "X", req.auth.sub, req.body.expected, req.body.counted, req.body.difference, req.body.note || "", shift.id]);
    res.json(await cashData());
  } catch (error) {
    next(error);
  }
});

try {
  await access(join(publicDirectory, "index.html"));
  app.use(express.static(publicDirectory));
  app.use((req, res, next) => (req.method === "GET" && !req.path.startsWith("/api/") && !req.path.startsWith("/uploads/") ? res.sendFile(join(publicDirectory, "index.html")) : next()));
} catch {
  console.warn("Frontend compilado no encontrado; la API continuará disponible.");
}

app.use((error, req, res, next) => {
  console.error(error);
  res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({ error: error.message || "Error interno del servidor." });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, "0.0.0.0", () => console.log(`Gastro Suite API disponible en 0.0.0.0:${port}`));
