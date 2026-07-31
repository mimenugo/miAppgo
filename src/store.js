import { useEffect, useState } from 'react'

const KEY = 'fuego-operations-v2'

export const seedProducts = [
  { id: 1, name: 'Tacos al pastor', desc: 'Piña asada, cebolla, cilantro y salsa tatemada.', price: 35, category: 'Tacos', station: 'Cocina', deliveryEnabled: true, emoji: '🌮', tone: 'coral', active: true },
  { id: 2, name: 'Smash fuego', desc: 'Doble carne, cheddar, cebolla caramelizada y papas.', price: 145, category: 'Hamburguesas', station: 'Cocina', deliveryEnabled: true, emoji: '🍔', tone: 'amber', active: true },
  { id: 3, name: 'Pizza mexicana', desc: 'Chorizo, jalapeño, cebolla morada y queso gratinado.', price: 210, category: 'Pizzas', station: 'Cocina', deliveryEnabled: true, emoji: '🍕', tone: 'red', active: true },
  { id: 4, name: 'Bowl del huerto', desc: 'Arroz, vegetales asados, aguacate y aderezo cítrico.', price: 125, category: 'Especiales', station: 'Barra', deliveryEnabled: true, emoji: '🥗', tone: 'green', active: true },
  { id: 5, name: 'Horchata rosa', desc: 'Horchata artesanal con fresa natural. 1 litro.', price: 52, category: 'Bebidas', station: 'Barra', deliveryEnabled: true, emoji: '🥤', tone: 'pink', active: true },
  { id: 6, name: 'Flan de la casa', desc: 'Cremoso, con caramelo de naranja y vainilla.', price: 62, category: 'Postres', station: 'Barra', deliveryEnabled: true, emoji: '🍮', tone: 'gold', active: true },
  { id: 7, name: 'Chiles rellenos', desc: 'Orden de 2 con arroz y frijoles.', price: 150, category: 'Especiales', station: 'Barra', deliveryEnabled: true, emoji: '🌶️', tone: 'green', active: true },
  { id: 8, name: 'Tamales', desc: 'Orden de 3 con frijoles y sopa fría.', price: 130, category: 'Especiales', station: 'Barra', deliveryEnabled: true, emoji: '🫔', tone: 'amber', active: true },
]

const initialState = {
  products: seedProducts,
  posSettings: {
    cashPrinter: 'Impresora principal de caja',
    kitchenPrinter: 'Impresora de cocina',
    barPrinter: 'Impresora de barra / mostrador',
    kitchenPrinterEnabled: true,
    barPrinterEnabled: true,
    cashDrawerEnabled: true,
    cashDrawerCompatible: false,
    accountHolder: 'Restaurante Fuego',
    bank: 'Banco de prueba',
    accountNumber: '0123456789',
    clabe: '012345678901234567',
    cardNumber: '',
    paymentQr: '',
    openingTime: '11:00',
    closingTime: '21:00',
    slotMinutes: 30,
    prepMinutes: 30,
    slotCapacity: 4,
  },
  cashRegister: {
    open: true,
    openedAt: new Date().toISOString(),
    openingAmount: 1500,
    openingOrderIds: [],
    movements: [
      { id: 1, type: 'Entrada', amount: 300, concept: 'Fondo adicional', createdAt: '10:15' },
      { id: 2, type: 'Retiro', amount: 450, concept: 'Pago a proveedor', createdAt: '12:40' },
    ],
    cuts: [],
  },
  customers: [
    { id: 1, name: 'Valeria Soto', phone: '33 1234 5678', address: 'Av. Reforma 214, Centro', orders: 6, total: 1840 },
    { id: 2, name: 'Marco Luna', phone: '33 7654 1122', address: 'Calle Olivo 88, Moderna', orders: 3, total: 920 },
    { id: 3, name: 'Ana Torres', phone: '33 8811 2299', address: 'López Cotilla 950, Americana', orders: 8, total: 2650 },
  ],
  orders: [
    { id: 'FG-1048', customer: 'Valeria Soto', phone: '664 123 5678', address: 'Blvd. Cucapah 21907-Interior 220, Villafontana, Lomas del Matamoros, 22206 Tijuana, B.C.', coordinates: [32.4965,-116.9145], serviceType: 'Domicilio', lines: [{ id: 2, name: 'Smash fuego', qty: 2, price: 145 }, { id: 5, name: 'Horchata rosa', qty: 1, price: 52 }], total: 381, payment: 'Tarjeta', paid: true, status: 'En cocina', createdAt: '12:18', createdHour: 12, driver: 'Roberto Gómez' },
    { id: 'FG-1047', customer: 'Marco Luna', phone: '664 765 1122', address: 'Veracruz & Del Cubilete, El Pipila, 22206 Tijuana, B.C.', coordinates: [32.4975,-116.8970], serviceType: 'Domicilio', lines: [{ id: 3, name: 'Pizza mexicana', qty: 1, price: 210 }, { id: 5, name: 'Horchata rosa', qty: 2, price: 52 }], total: 353, payment: 'Efectivo', paid: false, status: 'Listo', createdAt: '12:07', createdHour: 12, driver: 'Roberto Gómez' },
    { id: 'FG-1046', customer: 'Ana Torres', phone: '664 881 2299', address: 'Blvd. Gustavo Aubanel Vallejo 9058, Cacho, 22414 Tijuana, B.C.', coordinates: [32.5209,-117.0278], serviceType: 'Domicilio', lines: [{ id: 1, name: 'Tacos al pastor', qty: 3, price: 35 }, { id: 6, name: 'Flan de la casa', qty: 1, price: 62 }], total: 206, payment: 'Tarjeta', paid: true, status: 'En ruta', createdAt: '11:52', createdHour: 11, driver: 'Roberto Gómez' },
    { id: 'FG-1045', customer: 'Sofía Ramírez', phone: '664 310 2840', address: 'Calle Tabasco 2040, Cacho, 22414 Tijuana, B.C.', coordinates: [32.5196,-117.0248], serviceType: 'Domicilio', lines: [{ id: 7, name: 'Chiles rellenos', qty: 1, price: 150 }], total: 189, payment: 'Efectivo', paid: false, status: 'Asignado', createdAt: '11:34', createdHour: 11, driver: 'Roberto Gómez' },
    { id: 'FG-1044', customer: 'Daniel Ortega', phone: '664 222 7810', address: 'Plaza Mariana, Ruta Independencia 23696-4, Mariano Matamoros, 22206 Tijuana, B.C.', coordinates: [32.5005,-116.8735], serviceType: 'Domicilio', lines: [{ id: 8, name: 'Tamales', qty: 1, price: 130 }], total: 169, payment: 'Tarjeta', paid: true, status: 'Listo', createdAt: '11:20', createdHour: 11, driver: 'Roberto Gómez' },
    { id: 'FG-1043', customer: 'Elena Castro', phone: '664 542 9031', address: 'Av de La Joya 990, Matamoros Norte-Centro-Sur, Las Américas, 22215 Tijuana, B.C.', coordinates: [32.4885,-116.8855], serviceType: 'Domicilio', lines: [{ id: 4, name: 'Bowl del huerto', qty: 1, price: 125 }, { id: 5, name: 'Horchata rosa', qty: 1, price: 52 }], total: 216, payment: 'Efectivo', paid: false, status: 'En cocina', createdAt: '11:05', createdHour: 11, driver: 'Roberto Gómez' },
  ],
}

export function useRestaurantStore() {
  const [data, setData] = useState(() => {
    try {
      const saved = localStorage.getItem(KEY)
      if (!saved) return initialState
      const parsed = JSON.parse(saved)
      const savedProducts = parsed.products || initialState.products
      const migratedProducts = savedProducts.map(product => product.id === 1 && Number(product.price) === 95 ? { ...product, price: 35 } : product)
      seedProducts.slice(6).forEach(product => {
        if (!migratedProducts.some(savedProduct => savedProduct.id === product.id || savedProduct.name.toLowerCase() === product.name.toLowerCase())) migratedProducts.push(product)
      })
      const products = migratedProducts.map(product => ({
        ...product,
        station: product.station || (['Bebidas','Postres','Especiales'].includes(product.category) ? 'Barra' : 'Cocina'),
        deliveryEnabled: product.deliveryEnabled !== false,
      }))
      const demoLocations = Object.fromEntries(initialState.orders.map(order => [order.id, order]))
      const orders = (parsed.orders || initialState.orders).map(order => {
        const isCounterSale = ['Para llevar','En el lugar'].includes(order.serviceType) || order.phone === 'Mostrador' || order.customer === 'Venta mostrador' || order.address === 'Recoge en sucursal'
        const migrated = isCounterSale ? { ...order, serviceType: 'Para llevar', address: '', coordinates: undefined, driver: '' } : { ...order, serviceType: order.serviceType || 'Domicilio' }
        return demoLocations[order.id] ? { ...migrated, address: demoLocations[order.id].address, coordinates: demoLocations[order.id].coordinates, serviceType: 'Domicilio', phone: demoLocations[order.id].phone, lines: demoLocations[order.id].lines, total: demoLocations[order.id].total } : migrated
      })
      initialState.orders.forEach(order => {
        if (!orders.some(savedOrder => savedOrder.id === order.id)) orders.push(order)
      })
      const customers = (parsed.customers || initialState.customers).map(customer => customer.phone === 'Mostrador' || customer.name === 'Venta mostrador' ? { ...customer, address: '' } : customer)
      return {
        ...initialState,
        ...parsed,
        products,
        orders,
        customers,
        cashRegister: { ...initialState.cashRegister, ...(parsed.cashRegister || {}) },
        posSettings: { ...initialState.posSettings, ...(parsed.posSettings || {}) },
      }
    } catch {
      return initialState
    }
  })

  useEffect(() => localStorage.setItem(KEY, JSON.stringify(data)), [data])

  const updateOrder = (id, patch) => setData(current => ({
    ...current,
    orders: current.orders.map(order => order.id === id ? { ...order, ...patch } : order),
  }))

  const createOrder = payload => {
    const maxId = data.orders.reduce((max, order) => Math.max(max, Number(order.id.split('-')[1]) || 0), 1048)
    const now = new Date()
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const hasKitchen = payload.lines.some(line => ['Cocina','Ambas'].includes(line.station || 'Cocina'))
    const hasBar = payload.lines.some(line => ['Barra','Ambas'].includes(line.station))
    const serviceType = payload.serviceType || (payload.address === 'Recoge en sucursal' ? 'Para llevar' : 'Domicilio')
    const normalizedPayload = serviceType === 'Domicilio' ? payload : { ...payload, address: '', coordinates: undefined }
    const preparationStatus = {
      Cocina: hasKitchen ? 'Pendiente' : 'No aplica',
      Barra: hasBar ? 'Pendiente' : 'No aplica',
    }
    const order = {
      ...normalizedPayload,
      serviceType,
      id: `FG-${maxId + 1}`,
      createdAt: now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
      createdDate: localDate,
      createdHour: now.getHours(),
      status: payload.status || (payload.paid ? (hasKitchen || hasBar ? 'En preparación' : 'Pagado') : 'Pendiente de pago'),
      paymentStatus: payload.paid ? 'Pagado' : 'Pendiente de validar',
      preparationStatus,
      barStatus: hasBar ? 'Pendiente' : 'No aplica',
      driver: '',
    }
    setData(current => {
      const known = current.customers.find(customer => customer.phone === payload.phone)
      const customers = known
        ? current.customers.map(customer => customer.id === known.id ? { ...customer, orders: customer.orders + 1, total: customer.total + payload.total, address: serviceType === 'Domicilio' ? payload.address : customer.address } : customer)
        : [...current.customers, { id: Date.now(), name: payload.customer, phone: payload.phone, address: serviceType === 'Domicilio' ? payload.address : '', orders: 1, total: payload.total }]
      return { ...current, orders: [order, ...current.orders], customers }
    })
    return order
  }

  const saveProduct = product => setData(current => ({
    ...current,
    products: product.id
      ? current.products.map(item => item.id === product.id ? product : item)
      : [...current.products, { ...product, id: Date.now(), tone: 'amber', active: true }],
  }))

  const savePosSettings = settings => setData(current => ({
    ...current,
    posSettings: { ...current.posSettings, ...settings },
  }))

  const openCashRegister = openingAmount => setData(current => ({
    ...current,
    cashRegister: {
      ...current.cashRegister,
      open: true,
      openedAt: new Date().toISOString(),
      openingAmount: Number(openingAmount),
      openingOrderIds: current.orders.map(order => order.id),
      movements: [],
    },
  }))

  const addCashMovement = movement => setData(current => ({
    ...current,
    cashRegister: {
      ...current.cashRegister,
      movements: [
        { ...movement, id: Date.now(), amount: Number(movement.amount), createdAt: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) },
        ...current.cashRegister.movements,
      ],
    },
  }))

  const closeCashRegister = cut => setData(current => ({
    ...current,
    cashRegister: {
      ...current.cashRegister,
      open: false,
      cuts: [{ ...cut, id: Date.now(), closedAt: new Date().toLocaleString('es-MX') }, ...current.cashRegister.cuts],
    },
  }))

  return { ...data, createOrder, updateOrder, saveProduct, savePosSettings, openCashRegister, addCashMovement, closeCashRegister }
}
