import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  ArrowRight, BarChart3, Bike, Check, ChefHat, ChevronRight, CircleDollarSign,
  Clock3, CookingPot, CreditCard, Edit3, LayoutDashboard, Map, MapPin,
  MessageCircle, Minus, PackageCheck, Phone, Plus, Search, ShieldCheck,
  ShoppingBag, Sparkles, Star, Store, Trash2, UserPlus, Users, Wallet, X,
  Crosshair, History, LocateFixed, LogIn, Navigation, Printer, ReceiptText,
} from 'lucide-react'
import { useRestaurantStore } from './store'

const money = value => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value)
const pizzaSizeAdjustments = { Chica: -40, Mediana: 0, Grande: 70 }
const pizzaPrice = (basePrice, size) => Math.max(0, Number(basePrice) + (pizzaSizeAdjustments[size] || 0))
const lineText = order => order.lines.map(line => `${line.qty} ${line.name}${line.size ? ` · ${line.size}` : ''}${line.note ? ` (${line.note})` : ''}`).join(' · ')
const lineStation = (line, products) => line.station || products.find(product=>product.id===line.id)?.station || 'Cocina'
const lineInStation = (line, products, station) => {
  const assigned = lineStation(line, products)
  return assigned === station || assigned === 'Ambas'
}
const isDeliveryOrder = order => order.serviceType === 'Domicilio'
const WHATSAPP_TEST_NUMBER = '526645812107'

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]))
const printAreaDocument = ({ title, printer, order, lines, type = 'area' }) => {
  if (!lines.length) return false
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0'
  document.body.appendChild(frame)
  const products = lines.map(line => `<article><b>${line.qty}× ${escapeHtml(line.name)}${line.size ? ` · ${escapeHtml(line.size)}` : ''}</b>${line.note ? `<strong>INDICACIÓN: ${escapeHtml(line.note)}</strong>` : ''}</article>`).join('')
  const detail = type === 'sale'
    ? `<p class="total">TOTAL: ${escapeHtml(money(order.total))}</p><p>Pago: ${escapeHtml(order.payment)}</p>`
    : ''
  frame.contentDocument.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>@page{size:80mm auto;margin:4mm}body{font:12px monospace;color:#111}h1,h2,p{text-align:center;margin:5px 0}small{display:block;text-align:center}article{display:grid;gap:4px;padding:9px 0;border-bottom:1px dashed #555}article strong{font-size:11px}.meta{border-block:1px dashed #555;padding:8px;margin:10px 0}.total{font-size:17px;font-weight:900;border-top:2px solid #111;padding-top:10px}</style></head><body><h1>🔥 FUEGO</h1><h2>${escapeHtml(title)}</h2><small>Impresora configurada: ${escapeHtml(printer)}</small><div class="meta"><b>#${escapeHtml(order.id)}</b><br>${escapeHtml(order.customer)} · ${escapeHtml(order.serviceType)}<br>${escapeHtml(order.scheduleLabel || 'Ahora')}</div>${products}${detail}</body></html>`)
  frame.contentDocument.close()
  setTimeout(() => {
    frame.contentWindow.focus()
    frame.contentWindow.print()
    setTimeout(() => frame.remove(), 1000)
  }, 120)
  return true
}

const requestCashDrawer = (order, settings) => {
  if (order.payment !== 'Efectivo' || !settings.cashDrawerEnabled || !settings.cashDrawerCompatible) return false
  window.dispatchEvent(new CustomEvent('gastropos:open-cash-drawer', { detail: { orderId: order.id, printer: settings.cashPrinter } }))
  return true
}

const areaStatus = (order, area) => {
  if (order.preparationStatus?.[area]) return order.preparationStatus[area]
  if (area === 'Barra' && order.barStatus === 'Preparado') return 'Listo'
  if (order.status === 'Listo') return 'Listo'
  if (area === 'Cocina' && order.status === 'En cocina') return 'Preparando'
  return 'Pendiente'
}

const updatePreparationArea = (store, order, area, next) => {
  const preparationStatus = { ...(order.preparationStatus || {}), [area]: next }
  const other = area === 'Cocina' ? 'Barra' : 'Cocina'
  const otherDone = ['Listo','No aplica'].includes(preparationStatus[other] || areaStatus(order, other))
  const allDone = next === 'Listo' && otherDone
  store.updateOrder(order.id, {
    preparationStatus,
    barStatus: preparationStatus.Barra === 'Listo' ? 'Preparado' : order.barStatus,
    status: allDone ? (isDeliveryOrder(order) ? 'Listo para enviar' : 'Listo para recoger') : 'En preparación',
  })
}

function notifyOrderByWhatsApp(order) {
  const products = order.lines
    .map(line => `• ${line.qty} x ${line.name}${line.size ? ` (${line.size})` : ''}${line.note ? `\n  _Indicaciones: ${line.note}_` : ''} — ${money(line.price * line.qty)}`)
    .join('\n')
  const message = [
    '🔥 *NUEVO PEDIDO FUEGO*',
    `*Folio:* #${order.id}`,
    `*Cliente:* ${order.customer}`,
    order.phone && order.phone !== 'Mostrador' ? `*Teléfono:* ${order.phone}` : '',
    order.serviceType === 'Domicilio' && order.address ? `*Dirección:* ${order.address}` : '',
    order.reference ? `*Referencia:* ${order.reference}` : '',
    '',
    '*Productos:*',
    products,
    '',
    `*Total:* ${money(order.total)}`,
    `*Pago:* ${order.payment}${order.payment === 'Efectivo' && order.changeFor ? ` (paga con ${money(Number(order.changeFor))})` : ''}`,
  ].filter(Boolean).join('\n')
  window.open(`https://wa.me/${WHATSAPP_TEST_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
}

const roles = {
  administrador: { label: 'Administrador Full', icon: LayoutDashboard, subtitle: 'Acceso completo al restaurante' },
  cajero: { label: 'Cajero POS', icon: CircleDollarSign, subtitle: 'Ventas, caja y cortes' },
  barra: { label: 'Barra / Despacho', icon: PackageCheck, subtitle: 'Productos listos y entrega' },
  repartidor: { label: 'Repartidor Rutas', icon: Bike, subtitle: 'Entregas y navegación' },
  produccion: { label: 'Cocina / Comandas', icon: ChefHat, subtitle: 'Producción de pedidos' },
  cliente: { label: 'Cliente', icon: ShoppingBag, subtitle: 'Tienda pública para ordenar' },
}

function ProductMedia({ product, className = '' }) {
  return product.image
    ? <img className={`product-photo ${className}`} src={product.image} alt={product.name}/>
    : <span className={className}>{product.emoji || '🍽️'}</span>
}

function RolePicker({ role, openSessions }) {
  const CurrentIcon = roles[role].icon
  return <div className="role-picker">
    <button className="role-current" onClick={openSessions}>
      <span className="avatar"><CurrentIcon size={18}/></span><span><small>Sesión actual</small><strong>{roles[role].label}</strong></span><ChevronRight size={17}/>
    </button>
  </div>
}

function SessionSelector({ role, setRole, close }) {
  return <div className="session-gate"><section className="session-window"><div className="session-brand"><span>🔥</span><div><small>GASTRO SUITE</small><h1>Seleccionar sesión</h1><p>Modo demostración: por ahora no se solicita contraseña.</p></div></div><div className="session-grid">{Object.entries(roles).map(([key,item])=>{const Icon=item.icon;return <button key={key} className={key===role?'selected':''} onClick={()=>{setRole(key);close()}}><span><Icon/></span><div><b>{item.label}</b><small>{item.subtitle}</small></div><ChevronRight/></button>})}</div>{role&&<button className="session-cancel" onClick={close}>Continuar en {roles[role].label}</button>}</section></div>
}

function Header({ role, openSessions, cartCount, onCart }) {
  return <header>
    <a className="brand" href="#inicio"><span className="brand-mark">🔥</span><span>FUEGO<small>restaurant + delivery</small></span></a>
    <nav><a href="#inicio">Inicio</a><a href="#menu">Menú</a><a href="#pedidos">Pedidos</a></nav>
    <div className="header-actions"><RolePicker role={role} openSessions={openSessions}/>{role==='cliente'&&<button className="cart-button" onClick={onCart} aria-label="Abrir carrito"><ShoppingBag size={20}/><span>{cartCount}</span></button>}</div>
  </header>
}

function CustomerView({ products, cart, addItem, changeQty, updateNote, updateSize, showCart, setShowCart, createOrder }) {
  const [category,setCategory]=useState('Todos')
  const [query,setQuery]=useState('')
  const deliveryProducts=products.filter(p=>p.active&&p.deliveryEnabled!==false)
  const categories=['Todos',...new Set(deliveryProducts.map(p=>p.category))]
  const visible=deliveryProducts.filter(p=>(category==='Todos'||p.category===category)&&p.name.toLowerCase().includes(query.toLowerCase()))
  return <>
    <main className="customer" id="inicio">
      <section className="hero"><div className="hero-copy"><span className="eyebrow"><Sparkles size={15}/> Sabor local, directo a tu puerta</span><h1>Tu antojo merece llegar <em>caliente.</em></h1><p>Ingredientes frescos, cocina honesta y entregas que puedes seguir en tiempo real.</p><div className="hero-actions"><a className="primary" href="#menu">Ver el menú <ArrowRight size={18}/></a><span><Clock3 size={18}/><b>25–35 min</b><small>tiempo estimado</small></span></div></div><div className="hero-art"><div className="dish">🌮<span>🔥</span></div><div className="float-card top"><span>🛵</span><p><b>Entrega rápida</b><small>Seguimiento en vivo</small></p></div><div className="float-card bottom"><span>⭐</span><p><b>4.9 de 5</b><small>El favorito del barrio</small></p></div></div></section>
      <section className="menu-section" id="menu"><div className="section-heading"><div><span className="eyebrow">Nuestro menú</span><h2>Favoritos de la casa</h2></div><label className="search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar platillo"/></label></div>
        <div className="categories">{categories.map(item=><button key={item} className={category===item?'active':''} onClick={()=>setCategory(item)}>{item}</button>)}</div>
        <div className="product-grid">{visible.map(product=><article className="product-card" key={product.id}><div className={`product-image ${product.tone}`}><ProductMedia product={product}/><b><Star size={13} fill="currentColor"/> 4.9</b></div><div className="product-info"><small>{product.category}</small><h3>{product.name}</h3><p>{product.desc}</p><footer><strong>{money(product.price)}</strong><button onClick={()=>addItem(product)} aria-label={`Agregar ${product.name}`}><Plus size={19}/></button></footer></div></article>)}</div>
      </section>
    </main>
    {showCart&&<Checkout cart={cart} changeQty={changeQty} updateNote={updateNote} updateSize={updateSize} close={()=>setShowCart(false)} createOrder={createOrder}/>}
  </>
}

function Checkout({ cart, changeQty, updateNote, updateSize, close, createOrder }) {
  const [step,setStep]=useState('cart')
  const [payment,setPayment]=useState('Efectivo')
  const [form,setForm]=useState({customer:'',phone:'',address:'',reference:'',changeFor:''})
  const [result,setResult]=useState(null)
  const subtotal=cart.reduce((sum,row)=>sum+row.price*row.qty,0), delivery=39, total=subtotal+delivery
  const valid=form.customer.trim()&&form.phone.trim()&&form.address.trim()
  const confirm=()=>{const order=createOrder({...form,serviceType:'Domicilio',lines:cart.map(({id,name,price,qty,note,size,station})=>({id,name,price,qty,note,size,station})),subtotal,delivery,total,payment,paid:payment==='Tarjeta'});notifyOrderByWhatsApp(order);setResult(order);setStep('done')}
  return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&close()}><aside className="cart-panel">
    <div className="panel-head"><div><small>Pedido a domicilio</small><h2>{step==='cart'?'Tu bolsa':step==='checkout'?'Finalizar pedido':'¡Pedido confirmado!'}</h2></div><button onClick={close} aria-label="Cerrar"><X/></button></div>
    {step==='cart'&&<><div className="cart-list">{cart.length===0?<div className="empty"><ShoppingBag/><h3>Tu bolsa está vacía</h3></div>:cart.map(row=><div className="cart-row" key={row.id}><span className={`mini ${row.tone}`}>{row.emoji}</span><div><b>{row.name}</b><small>{money(row.price)}</small></div><div className="qty"><button onClick={()=>changeQty(row.id,-1)} aria-label={`Reducir ${row.name}`}><Minus size={14}/></button><span>{row.qty}</span><button onClick={()=>changeQty(row.id,1)} aria-label={`Aumentar ${row.name}`}><Plus size={14}/></button></div>{row.category==='Pizzas'&&<label className="item-size">Tamaño<select value={row.size||'Mediana'} onChange={e=>updateSize(row.id,e.target.value)}>{Object.keys(pizzaSizeAdjustments).map(size=><option key={size}>{size}</option>)}</select></label>}<label className="item-note">Indicaciones para cocina<input value={row.note||''} onChange={e=>updateNote(row.id,e.target.value)} placeholder="Ej. sin salsa, sin tomate, sin cebolla"/></label></div>)}</div>{cart.length>0&&<OrderTotal subtotal={subtotal} delivery={delivery} total={total}><button className="primary wide" onClick={()=>setStep('checkout')}>Continuar <ArrowRight size={18}/></button></OrderTotal>}</>}
    {step==='checkout'&&<div className="checkout-form"><div className="step-title"><span>1</span><h3>Datos de entrega</h3></div><div className="form-grid"><label>Nombre completo<input value={form.customer} onChange={e=>setForm({...form,customer:e.target.value})} placeholder="¿Quién recibe?"/></label><label>Teléfono<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="33 1234 5678"/></label><label className="full">Dirección<input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="Calle, número, colonia"/></label><label className="full">Referencia<input value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})} placeholder="Portón, entre calles, indicaciones"/></label></div>
      <div className="step-title"><span>2</span><h3>Método de pago</h3></div><div className="payment-options"><button className={payment==='Efectivo'?'active':''} onClick={()=>setPayment('Efectivo')}><Wallet/><span><b>Efectivo</b><small>Paga al recibir</small></span>{payment==='Efectivo'&&<Check/>}</button><button className={payment==='Tarjeta'?'active':''} onClick={()=>setPayment('Tarjeta')}><CreditCard/><span><b>Tarjeta</b><small>Pago seguro</small></span>{payment==='Tarjeta'&&<Check/>}</button></div>
      {payment==='Efectivo'&&<label className="change-field">¿Con cuánto pagarás?<input type="number" value={form.changeFor} onChange={e=>setForm({...form,changeFor:e.target.value})} placeholder={`Mínimo ${total}`}/></label>}
      {payment==='Tarjeta'&&<div className="card-note"><ShieldCheck/> Demo: la tarjeta se marca como pagada. En producción se conectará una pasarela segura.</div>}
      <OrderTotal subtotal={subtotal} delivery={delivery} total={total}><button className="primary wide" disabled={!valid} onClick={confirm}>Confirmar y enviar por WhatsApp <ArrowRight size={18}/></button><small className="whatsapp-note"><MessageCircle size={14}/> También se registra en cocina y administración</small></OrderTotal></div>}
    {step==='done'&&<div className="success"><span><Check size={36}/></span><h3>Ya recibimos tu pedido</h3><p>Pedido <b>#{result.id}</b> · Pago en <b>{result.payment.toLowerCase()}</b>.</p><div className="tracking"><i className="done"/><i className="active"/><i/><small>Confirmado</small><small>Producción</small><small>En camino</small></div><button className="primary wide" onClick={close}>Cerrar</button></div>}
  </aside></div>
}

function OrderTotal({subtotal,delivery,total,children}){return <div className="checkout"><p><span>Subtotal</span><b>{money(subtotal)}</b></p><p><span>Envío</span><b>{money(delivery)}</b></p><p className="total"><span>Total</span><b>{money(total)}</b></p>{children}</div>}

const modules=[['Resumen',LayoutDashboard],['Pedidos',ShoppingBag],['Caja',ReceiptText],['Producción',CookingPot],['Barra',PackageCheck],['Reparto',Bike],['Productos',Store],['Clientes',Users],['Reportes',BarChart3]]
function DashboardShell({active,setActive,children,onNewSale,title='Centro de operación',subtitle='Todo tu restaurante en un solo lugar.',moduleItems=modules}) {
  return <main className="app-shell"><aside className="sidebar"><div className="side-brand">🔥</div>{moduleItems.map(([label,Icon])=><button className={active===label?'active':''} key={label} onClick={()=>setActive(label)}><Icon/><span>{label}</span></button>)}</aside><div className="workspace"><div className="workspace-head"><div><span className="eyebrow">Panel de control</span><h1>{title}</h1><p>{subtitle}</p></div>{onNewSale&&<button className="outline" onClick={onNewSale}><Plus/> Nueva venta</button>}</div>{children}</div></main>
}

function AdminView({store, initialActive = 'Resumen'}) {
  const [active,setActive]=useState(initialActive)
  const [saleOpen,setSaleOpen]=useState(false)
  return <DashboardShell active={active} setActive={setActive} onNewSale={()=>setSaleOpen(true)} title={active} subtitle="Información sincronizada con cocina y reparto.">
    {active==='Resumen'&&<Summary store={store}/>}
    {active==='Pedidos'&&<OrdersModule store={store}/>}
    {active==='Caja'&&<CashControl store={store}/>}
    {active==='Producción'&&<ProductionBoard store={store}/>}
    {active==='Barra'&&<BarBoard store={store}/>}
    {active==='Reparto'&&<DispatchModule store={store}/>}
    {active==='Productos'&&<ProductsModule store={store}/>}
    {active==='Clientes'&&<CustomersModule customers={store.customers}/>}
    {active==='Reportes'&&<ReportsModule store={store}/>}
    {saleOpen&&<PointOfSale store={store} close={()=>setSaleOpen(false)}/>}
  </DashboardShell>
}

function CashierView({store}) {
  const [active,setActive]=useState('Caja')
  const [saleOpen,setSaleOpen]=useState(false)
  const cashierModules=[['Caja',ReceiptText],['Pedidos',ShoppingBag]]
  return <DashboardShell active={active} setActive={setActive} moduleItems={cashierModules} onNewSale={()=>setSaleOpen(true)} title={active==='Caja'?'Control y arqueo de caja':'Pedidos de caja'} subtitle="Punto de venta y control del turno actual.">
    {active==='Caja'&&<CashControl store={store}/>}
    {active==='Pedidos'&&<OrdersModule store={store}/>}
    {saleOpen&&<PointOfSale store={store} close={()=>setSaleOpen(false)}/>}
  </DashboardShell>
}

function Summary({store}) {
  const sales=store.orders.reduce((sum,o)=>sum+o.total,0), active=store.orders.filter(o=>!['Entregado','Cancelado'].includes(o.status)).length
  const stats=[['Ventas registradas',money(sales),CircleDollarSign,'orange'],['Pedidos',store.orders.length,ShoppingBag,'blue'],['En proceso',active,CookingPot,'green'],['Clientes',store.customers.length,Users,'purple']]
  return <><div className="stats">{stats.map(([label,value,Icon,tone])=><article key={label}><span className={tone}><Icon/></span><small>{label}</small><h3>{value}</h3><p>Actualizado ahora</p></article>)}</div><section className="dash-card orders-card module-space"><div className="card-title"><div><small>Operación en vivo</small><h2>Pedidos recientes</h2></div></div>{store.orders.slice(0,5).map(order=><OrderRow order={order} key={order.id}/>)}</section></>
}

function OrderRow({order}){return <div className="order-row"><span className="order-icon"><ShoppingBag/></span><div><b>#{order.id}</b><small>{order.customer} · {lineText(order)}</small></div><b>{money(order.total)}</b><span className={`status ${order.status.toLowerCase().replaceAll(' ','-')}`}>{order.status}</span><small>{order.createdAt}</small></div>}

function OrdersModule({store}) {
  const statuses=['Pendiente de pago','Pagado','Nuevo','En cocina','En barra','En preparación','Listo','Listo para recoger','Listo para enviar','Asignado','Asignado a repartidor','En ruta','Entregado','Cancelado']
  return <section className="dash-card data-card"><div className="card-title"><div><small>Todos los canales</small><h2>Pedidos y ventas</h2></div></div><div className="data-table">{store.orders.map(order=><div className="data-row order-data" key={order.id}><b>#{order.id}</b><div><strong>{order.customer}</strong><small>{lineText(order)} · {order.serviceType||'Domicilio'}</small></div><span>{order.payment}<small>{order.paymentStatus||(order.paid?'Pagado':'Pendiente de pago')}</small></span><b>{money(order.total)}</b><select value={order.status} onChange={e=>store.updateOrder(order.id,{status:e.target.value})}>{statuses.map(status=><option key={status}>{status}</option>)}</select></div>)}</div></section>
}

function ProductionBoard({store}) {
  const kitchenLines=order=>order.lines.filter(line=>lineInStation(line,store.products,'Cocina'))
  const visible=store.orders.filter(order=>!['Entregado','Cancelado','Pendiente de pago'].includes(order.status)&&kitchenLines(order).length)
  const columns=[['Pendiente','Nuevo','stage-new'],['Preparando','En preparación','stage-cooking'],['Listo','Listo','stage-ready']]
  return <div className="kanban">{columns.map(([areaState,label,className])=><section className={className} key={areaState}><header><h2>{label}</h2><span>{visible.filter(order=>areaStatus(order,'Cocina')===areaState).length}</span></header>{visible.filter(order=>areaStatus(order,'Cocina')===areaState).map(order=><article className="ticket" key={order.id}><div><b>#{order.id}</b><span><Clock3/> {order.createdAt}</span></div><h3>{lineText({...order,lines:kitchenLines(order)})}</h3><p><strong>Cliente:</strong> {order.customer}{order.scheduleLabel?` · ${order.scheduleLabel}`:''}</p>{areaState!=='Listo'&&<footer><span>{order.payment}</span><button onClick={()=>updatePreparationArea(store,order,'Cocina',areaState==='Pendiente'?'Preparando':'Listo')}>{areaState==='Pendiente'?'Aceptar':'Terminar cocina'} <Check/></button></footer>}</article>)}</section>)}</div>
}

function BarBoard({store}) {
  const barLines=order=>order.lines.filter(line=>lineInStation(line,store.products,'Barra'))
  const orders=store.orders.filter(order=>!['Entregado','Cancelado','Pendiente de pago'].includes(order.status)&&barLines(order).length)
  const pending=orders.filter(order=>areaStatus(order,'Barra')!=='Listo')
  const prepared=orders.filter(order=>areaStatus(order,'Barra')==='Listo')
  const Card=({order,done=false})=>{const state=areaStatus(order,'Barra');const ready=['Listo para recoger','Listo para enviar','Listo'].includes(order.status);return <article className={`bar-ticket ${done?'prepared':''}`}><div className="bar-ticket-head"><div><small>#{order.id}</small><h3>{order.customer}</h3></div><span className={`status ${done?'entregado':'en-barra'}`}>{done?'Listo':state==='Preparando'?'Preparando':'Nuevo'}</span></div><div className="bar-items">{barLines(order).map(line=><p key={`${order.id}-${line.id}`}><span>{line.qty}×</span><b>{line.name}</b>{line.note&&<small>{line.note}</small>}</p>)}</div><footer><span>{isDeliveryOrder(order)?'Pedido a domicilio':order.serviceType||'Recoger en restaurante'}</span>{!done?<button className="primary" onClick={()=>updatePreparationArea(store,order,'Barra',state==='Pendiente'?'Preparando':'Listo')}>{state==='Pendiente'?'Aceptar':'Marcar listo'} <Check/></button>:!ready?<b className="bar-waiting"><CookingPot/> Esperando cocina</b>:!isDeliveryOrder(order)?<button className="outline" onClick={()=>store.updateOrder(order.id,{status:'Entregado'})}>Entregar al cliente</button>:<b className="bar-ready"><Bike/> Listo para reparto</b>}</footer></article>}
  return <div className="bar-board"><section><header><div><small>BARRA / LISTO PARA SERVIR</small><h2>Por preparar / despachar</h2></div><span>{pending.length}</span></header><div className="bar-grid">{pending.length?pending.map(order=><Card order={order} key={order.id}/>):<Empty text="No hay productos pendientes en barra"/>}</div></section><section><header><div><small>COMPLETADOS</small><h2>Preparados</h2></div><span>{prepared.length}</span></header><div className="bar-grid">{prepared.length?prepared.map(order=><Card order={order} done key={order.id}/>):<Empty text="No hay pedidos preparados"/>}</div></section></div>
}

function DispatchModule({store}) {
  const orders=store.orders.filter(o=>isDeliveryOrder(o)&&['Nuevo','En barra','En cocina','Listo','En preparación','Listo para enviar','Asignado','Asignado a repartidor','En ruta'].includes(o.status))
  const readyStatus=status=>['Listo','Listo para enviar'].includes(status)
  const assignDriver=(order,driver)=>store.updateOrder(order.id,{driver,status:driver&&readyStatus(order.status)?'Asignado a repartidor':['Asignado','Asignado a repartidor'].includes(order.status)&&!driver?'Listo para enviar':order.status})
  return <section className="dash-card data-card"><div className="card-title"><div><small>Última milla</small><h2>Asignación de reparto</h2></div></div>{orders.length===0?<Empty text="No hay pedidos para reparto"/>:<div className="delivery-list">{orders.map(order=><article key={order.id}><div><span className="order-icon"><Bike/></span><div><b>#{order.id} · {order.customer}</b><small><MapPin/> {order.address}</small>{!order.driver&&<small>Pendiente de asignar</small>}</div></div><div><select value={order.driver} onChange={e=>assignDriver(order,e.target.value)}><option value="">Sin asignar</option><option>Roberto Gómez</option><option>Luis Fernando Ruiz</option></select><span className={`status ${order.status.toLowerCase().replace(' ','-')}`}>{order.status}</span></div></article>)}</div>}</section>
}

function CashControl({store}) {
  const [tab,setTab]=useState('Estado de caja')
  const [movement,setMovement]=useState({type:'Entrada',amount:'',concept:''})
  const [opening,setOpening]=useState(1500)
  const [counted,setCounted]=useState('')
  const [note,setNote]=useState('')
  const [posSettings,setPosSettings]=useState(store.posSettings)
  const [settingsSaved,setSettingsSaved]=useState(false)
  const cash=store.cashRegister
  const cashSales=store.orders.filter(o=>o.payment==='Efectivo'&&o.paid&&o.status!=='Cancelado'&&!cash.openingOrderIds.includes(o.id)).reduce((sum,o)=>sum+o.total,0)
  const inputs=cash.movements.filter(m=>m.type==='Entrada').reduce((sum,m)=>sum+m.amount,0)
  const withdrawals=cash.movements.filter(m=>m.type==='Retiro').reduce((sum,m)=>sum+m.amount,0)
  const expected=Number(cash.openingAmount)+cashSales+inputs-withdrawals
  const addMovement=()=>{if(Number(movement.amount)>0&&movement.concept.trim()){store.addCashMovement(movement);setMovement({...movement,amount:'',concept:''})}}
  const closeRegister=()=>{if(counted==='')return;store.closeCashRegister({openingAmount:cash.openingAmount,cashSales,inputs,withdrawals,expected,counted:Number(counted),difference:Number(counted)-expected,note});setCounted('');setNote('');setTab('Historial de cortes')}
  const saveSettings=()=>{store.savePosSettings(posSettings);setSettingsSaved(true);setTimeout(()=>setSettingsSaved(false),1800)}
  const tabs=['Estado de caja','Entradas / retiros','Cierre de caja (Z)','Historial de cortes','Configuración POS']
  return <div className="cash-module"><div className="cash-tabs">{tabs.map(item=><button key={item} className={tab===item?'active':''} onClick={()=>setTab(item)}>{item}</button>)}</div>
    {tab==='Estado de caja'&&<><section className={`cash-status ${cash.open?'open':'closed'}`}><div><span className="live-dot"/><small>{cash.open?'CAJA ABIERTA':'CAJA CERRADA'}</small><h2>{cash.open?'Turno en operación':'Inicia un nuevo turno'}</h2><p>{cash.open?`Apertura: ${new Date(cash.openedAt).toLocaleString('es-MX')}`:'Registra el fondo inicial para comenzar a vender.'}</p></div>{cash.open?<ReceiptText/>:<div className="cash-open-form"><input type="number" min="0" value={opening} onChange={e=>setOpening(e.target.value)}/><button className="primary" onClick={()=>store.openCashRegister(opening)}><LogIn/> Abrir caja</button></div>}</section>{cash.open&&<div className="cash-summary"><article><small>Fondo inicial</small><h3>{money(cash.openingAmount)}</h3></article><article><small>Ventas en efectivo</small><h3>{money(cashSales)}</h3></article><article><small>Entradas y retiros</small><h3>{money(inputs-withdrawals)}</h3></article><article className="expected"><small>Efectivo esperado</small><h3>{money(expected)}</h3></article></div>}<section className="dash-card cash-breakdown"><div className="card-title"><div><small>Resumen del turno</small><h2>Desglose de caja</h2></div></div><p><span>Fondo de apertura</span><b>{money(cash.openingAmount)}</b></p><p><span>Ventas en efectivo</span><b>{money(cashSales)}</b></p><p><span>Entradas</span><b className="positive">+ {money(inputs)}</b></p><p><span>Retiros</span><b className="negative">− {money(withdrawals)}</b></p><p className="cash-total"><span>Total esperado</span><b>{money(expected)}</b></p></section></>}
    {tab==='Entradas / retiros'&&<div className="cash-two-columns"><section className="dash-card"><div className="card-title"><div><small>Nuevo movimiento</small><h2>Registrar entrada o retiro</h2></div></div><div className="cash-movement-form"><label>Tipo<select value={movement.type} onChange={e=>setMovement({...movement,type:e.target.value})}><option>Entrada</option><option>Retiro</option></select></label><label>Monto<input type="number" min="0" value={movement.amount} onChange={e=>setMovement({...movement,amount:e.target.value})} placeholder="0.00"/></label><label className="full">Concepto<input value={movement.concept} onChange={e=>setMovement({...movement,concept:e.target.value})} placeholder="Ej. pago a proveedor, fondo adicional"/></label><button className="primary full" disabled={!cash.open||!movement.concept||Number(movement.amount)<=0} onClick={addMovement}>Guardar movimiento</button></div></section><section className="dash-card"><div className="card-title"><div><small>Bitácora</small><h2>Movimientos del turno</h2></div></div><div className="movement-list">{cash.movements.length===0?<Empty text="Sin movimientos registrados"/>:cash.movements.map(item=><article key={item.id}><span className={item.type==='Entrada'?'in':'out'}>{item.type==='Entrada'?'+':'−'}</span><div><b>{item.concept}</b><small>{item.createdAt} · {item.type}</small></div><strong>{money(item.amount)}</strong></article>)}</div></section></div>}
    {tab==='Cierre de caja (Z)'&&<section className="dash-card close-register"><div className="card-title"><div><small>Arqueo final</small><h2>Cierre de caja (Z)</h2></div><span className={`status ${cash.open?'en-ruta':'entregado'}`}>{cash.open?'Pendiente':'Cerrada'}</span></div>{cash.open?<><div className="close-grid"><div><small>Efectivo esperado</small><h2>{money(expected)}</h2><p>Incluye fondo, ventas y movimientos.</p></div><label>Efectivo contado<input type="number" min="0" value={counted} onChange={e=>setCounted(e.target.value)} placeholder="Captura el total físico"/></label><label className="full">Observaciones<input value={note} onChange={e=>setNote(e.target.value)} placeholder="Notas del cierre o aclaraciones"/></label></div>{counted!==''&&<div className={`difference ${Number(counted)-expected===0?'balanced':Number(counted)-expected>0?'positive':'negative'}`}><span>Diferencia de caja</span><b>{money(Number(counted)-expected)}</b></div>}<button className="primary" disabled={counted===''} onClick={closeRegister}>Confirmar cierre Z</button></>:<Empty text="La caja ya fue cerrada. Revisa el historial o abre un nuevo turno."/>}</section>}
    {tab==='Historial de cortes'&&<section className="dash-card"><div className="card-title"><div><small>Cortes Z</small><h2>Historial de cierres</h2></div><b>{cash.cuts.length} cortes</b></div><div className="cuts-list">{cash.cuts.length===0?<Empty text="Todavía no hay cierres de caja"/>:cash.cuts.map(cut=><article key={cut.id}><span><History/></span><div><b>Corte #{String(cut.id).slice(-6)}</b><small>{cut.closedAt}{cut.note?` · ${cut.note}`:''}</small></div><div><small>Esperado</small><b>{money(cut.expected)}</b></div><div><small>Contado</small><b>{money(cut.counted)}</b></div><div><small>Diferencia</small><b className={cut.difference===0?'':cut.difference>0?'positive':'negative'}>{money(cut.difference)}</b></div></article>)}</div></section>}
    {tab==='Configuración POS'&&<section className="dash-card pos-settings"><div className="card-title"><div><small>Hardware y operación</small><h2>Impresoras, cajón y pagos</h2></div>{settingsSaved&&<span className="settings-saved"><Check/> Guardado</span>}</div><div className="settings-grid">
      <fieldset><legend>Impresión por área</legend><label>Impresora de caja<input value={posSettings.cashPrinter} onChange={e=>setPosSettings({...posSettings,cashPrinter:e.target.value})}/></label><label>Impresora de cocina<input value={posSettings.kitchenPrinter} onChange={e=>setPosSettings({...posSettings,kitchenPrinter:e.target.value})}/></label><label className="inline-check"><input type="checkbox" checked={posSettings.kitchenPrinterEnabled} onChange={e=>setPosSettings({...posSettings,kitchenPrinterEnabled:e.target.checked})}/> Enviar comandas a cocina</label><label>Impresora de barra<input value={posSettings.barPrinter} onChange={e=>setPosSettings({...posSettings,barPrinter:e.target.value})}/></label><label className="inline-check"><input type="checkbox" checked={posSettings.barPrinterEnabled} onChange={e=>setPosSettings({...posSettings,barPrinterEnabled:e.target.checked})}/> Enviar comandas a barra</label></fieldset>
      <fieldset><legend>Cajón de dinero</legend><label className="inline-check"><input type="checkbox" checked={posSettings.cashDrawerEnabled} onChange={e=>setPosSettings({...posSettings,cashDrawerEnabled:e.target.checked})}/> Abrir al cobrar en efectivo</label><label className="inline-check"><input type="checkbox" checked={posSettings.cashDrawerCompatible} onChange={e=>setPosSettings({...posSettings,cashDrawerCompatible:e.target.checked})}/> Impresora/cajón compatibles y con puente POS configurado</label><p className="settings-note">La aplicación emite el evento <code>gastropos:open-cash-drawer</code>. La apertura física y el envío silencioso a una impresora específica requieren un conector local compatible con ESC/POS.</p></fieldset>
      <fieldset><legend>Transferencia / Depósito</legend><label>Titular<input value={posSettings.accountHolder} onChange={e=>setPosSettings({...posSettings,accountHolder:e.target.value})}/></label><label>Banco<input value={posSettings.bank} onChange={e=>setPosSettings({...posSettings,bank:e.target.value})}/></label><label>Número de cuenta<input value={posSettings.accountNumber} onChange={e=>setPosSettings({...posSettings,accountNumber:e.target.value})}/></label><label>CLABE<input value={posSettings.clabe} onChange={e=>setPosSettings({...posSettings,clabe:e.target.value})}/></label><label>Número de tarjeta<input value={posSettings.cardNumber} onChange={e=>setPosSettings({...posSettings,cardNumber:e.target.value})}/></label><label>URL del código QR<input value={posSettings.paymentQr} onChange={e=>setPosSettings({...posSettings,paymentQr:e.target.value})}/></label></fieldset>
      <fieldset><legend>Pedidos programados</legend><div className="settings-row"><label>Apertura<input type="time" value={posSettings.openingTime} onChange={e=>setPosSettings({...posSettings,openingTime:e.target.value})}/></label><label>Cierre<input type="time" value={posSettings.closingTime} onChange={e=>setPosSettings({...posSettings,closingTime:e.target.value})}/></label></div><div className="settings-row"><label>Intervalo (min)<input type="number" min="10" value={posSettings.slotMinutes} onChange={e=>setPosSettings({...posSettings,slotMinutes:Number(e.target.value)})}/></label><label>Preparación (min)<input type="number" min="0" value={posSettings.prepMinutes} onChange={e=>setPosSettings({...posSettings,prepMinutes:Number(e.target.value)})}/></label><label>Capacidad por horario<input type="number" min="1" value={posSettings.slotCapacity} onChange={e=>setPosSettings({...posSettings,slotCapacity:Number(e.target.value)})}/></label></div></fieldset>
    </div><button className="primary" onClick={saveSettings}>Guardar configuración</button></section>}
  </div>
}

function ProductsModule({store}) {
  const categories=['Tacos','Hamburguesas','Pizzas','Especiales','Bebidas','Postres']
  const stationLabel=station=>station==='Barra'?'Barra / Listo para servir':station==='Ambas'?'Cocina y Barra':'Cocina'
  const empty={name:'',desc:'',price:'',category:'Tacos',station:'Cocina',deliveryEnabled:true,emoji:'🍽️',image:'',active:true}
  const [editing,setEditing]=useState(null)
  const save=()=>{if(editing.name&&Number(editing.price)>0){store.saveProduct({...editing,price:Number(editing.price)});setEditing(null)}}
  const loadImage=file=>{if(!file)return;if(file.size>1500000){alert('La imagen debe pesar menos de 1.5 MB.');return}const reader=new FileReader();reader.onload=()=>setEditing(current=>({...current,image:reader.result}));reader.readAsDataURL(file)}
  return <>
    <div className="module-toolbar"><p>{store.products.length} productos registrados</p><button className="primary" onClick={()=>setEditing(empty)}><Plus/> Nuevo producto</button></div>
    <div className="product-admin-grid">{store.products.map(product=><article key={product.id}><span className={product.tone}><ProductMedia product={product}/></span><div><small>{product.category}</small><h3>{product.name}</h3><b>{money(product.price)}</b><div className="product-badges"><em className={`station-badge ${product.station==='Barra'?'bar':product.station==='Ambas'?'both':''}`}>{stationLabel(product.station)}</em>{product.deliveryEnabled===false&&<em className="station-badge local-only">Solo venta local</em>}</div></div><label className="switch"><input type="checkbox" checked={product.active} onChange={()=>store.saveProduct({...product,active:!product.active})}/><i/></label><button className="icon-edit" onClick={()=>setEditing(product)}><Edit3/></button></article>)}</div>
    {editing&&<Modal title={editing.id?'Editar producto':'Nuevo producto'} close={()=>setEditing(null)}><div className="form-grid">
      <label>Nombre<input value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})}/></label>
      <label>Precio<input type="number" value={editing.price} onChange={e=>setEditing({...editing,price:e.target.value})}/></label>
      <label>Categoría<select value={editing.category} onChange={e=>setEditing({...editing,category:e.target.value})}>{categories.map(category=><option key={category} value={category}>{category}</option>)}</select></label>
      <label>Área de preparación<select value={editing.station||'Cocina'} onChange={e=>setEditing({...editing,station:e.target.value})}><option value="Cocina">Cocina</option><option value="Barra">Barra / Listo para servir</option><option value="Ambas">Cocina y Barra</option></select></label>
      <label className="delivery-check"><input type="checkbox" checked={editing.deliveryEnabled!==false} onChange={e=>setEditing({...editing,deliveryEnabled:e.target.checked})}/><span><b>Disponible para reparto</b><small>Si se desactiva, solo podrá venderse desde Caja.</small></span></label>
      <label>Emoji de respaldo<input value={editing.emoji} onChange={e=>setEditing({...editing,emoji:e.target.value})}/></label>
      <label className="full image-field">Imagen del producto<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>loadImage(e.target.files?.[0])}/><small>PNG, JPG o WebP · máximo 1.5 MB</small>{editing.image&&<div className="image-preview"><img src={editing.image} alt="Vista previa"/><button type="button" onClick={()=>setEditing({...editing,image:''})}><Trash2/> Quitar imagen</button></div>}</label>
      <label className="full">Descripción<input value={editing.desc} onChange={e=>setEditing({...editing,desc:e.target.value})}/></label>
    </div><button className="primary wide modal-save" onClick={save}>Guardar producto</button></Modal>}
  </>
}

function CustomersModule({customers}) {
  const [query,setQuery]=useState('');const visible=customers.filter(c=>`${c.name} ${c.phone}`.toLowerCase().includes(query.toLowerCase()))
  return <section className="dash-card data-card"><div className="module-toolbar"><label className="search"><Search/><input placeholder="Buscar cliente" value={query} onChange={e=>setQuery(e.target.value)}/></label><b>{visible.length} clientes</b></div><div className="customer-list">{visible.map(customer=><article key={customer.id}><span>{customer.name.split(' ').map(x=>x[0]).join('').slice(0,2)}</span><div><b>{customer.name}</b><small>{customer.phone}</small></div><div><small>{customer.address?'Dirección':'Tipo de venta'}</small><p>{customer.address||'Para llevar · sin dirección'}</p></div><div><b>{customer.orders}</b><small>pedidos</small></div><div><b>{money(customer.total)}</b><small>consumo</small></div></article>)}</div></section>
}

function ReportsModule({store}) {
  const toISO=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
  const today=toISO(new Date())
  const [period,setPeriod]=useState('diaria')
  const [referenceDate,setReferenceDate]=useState(today)
  const [month,setMonth]=useState(today.slice(0,7))
  const [from,setFrom]=useState(today)
  const [to,setTo]=useState(today)
  const [shift,setShift]=useState('Matutino')
  const orderDate=order=>order.createdDate||today
  const orderHour=order=>{if(Number.isInteger(order.createdHour))return order.createdHour;const match=String(order.createdAt||'').match(/(\d{1,2})/);let hour=Number(match?.[1]||0);if(/p\.?\s*m/i.test(order.createdAt||'')&&hour<12)hour+=12;if(/a\.?\s*m/i.test(order.createdAt||'')&&hour===12)hour=0;return hour}
  let rangeStart=referenceDate,rangeEnd=referenceDate
  if(period==='semanal'){const date=new Date(`${referenceDate}T12:00:00`);const day=date.getDay()||7;date.setDate(date.getDate()-day+1);rangeStart=toISO(date);date.setDate(date.getDate()+6);rangeEnd=toISO(date)}
  if(period==='mensual'){rangeStart=`${month}-01`;const date=new Date(`${month}-01T12:00:00`);rangeEnd=toISO(new Date(date.getFullYear(),date.getMonth()+1,0))}
  if(period==='periodo'){rangeStart=from;rangeEnd=to}
  const shifts={Matutino:[6,14],Vespertino:[14,22],Nocturno:[22,6]}
  const filtered=store.orders.filter(order=>{const date=orderDate(order);if(date<rangeStart||date>rangeEnd)return false;if(period!=='turno')return true;const hour=orderHour(order),[start,end]=shifts[shift];return start<end?hour>=start&&hour<end:hour>=start||hour<end})
  const cash=filtered.filter(o=>o.payment==='Efectivo').reduce((s,o)=>s+o.total,0)
  const card=filtered.filter(o=>['Tarjeta','Transferencia / Depósito'].includes(o.payment)).reduce((s,o)=>s+o.total,0)
  const total=cash+card
  const ticket=filtered.length?total/filtered.length:0
  const rangeLabel=period==='turno'?`${referenceDate} · ${shift}`:rangeStart===rangeEnd?rangeStart:`${rangeStart} al ${rangeEnd}`
  return <div className="reports-module">
    <section className="dash-card report-filters"><div><small>Tipo de reporte</small><h2>Ventas por periodo</h2></div><div className="report-controls"><label>Vista<select value={period} onChange={e=>setPeriod(e.target.value)}><option value="turno">Por turno</option><option value="diaria">Diaria</option><option value="semanal">Semanal</option><option value="mensual">Mensual</option><option value="periodo">Periodo personalizado</option></select></label>{['turno','diaria','semanal'].includes(period)&&<label>Fecha de referencia<input type="date" value={referenceDate} onChange={e=>setReferenceDate(e.target.value)}/></label>}{period==='turno'&&<label>Turno<select value={shift} onChange={e=>setShift(e.target.value)}><option>Matutino</option><option>Vespertino</option><option>Nocturno</option></select></label>}{period==='mensual'&&<label>Mes<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label>}{period==='periodo'&&<><label>Desde<input type="date" value={from} max={to} onChange={e=>setFrom(e.target.value)}/></label><label>Hasta<input type="date" value={to} min={from} onChange={e=>setTo(e.target.value)}/></label></>}</div><p className="range-label"><Clock3/> Mostrando: <b>{rangeLabel}</b></p></section>
    <div className="report-summary"><article><small>Venta total</small><h3>{money(total)}</h3></article><article><small>Pedidos</small><h3>{filtered.length}</h3></article><article><small>Ticket promedio</small><h3>{money(ticket)}</h3></article><article><small>Entregados</small><h3>{filtered.filter(o=>o.status==='Entregado').length}</h3></article></div>
    <div className="report-grid"><article className="dash-card"><small>Ventas por método</small><h2>{money(total)}</h2><div className="payment-bar"><span style={{width:`${total?(cash/total)*100:0}%`}}/></div><p><i className="cash-dot"/> Efectivo <b>{money(cash)}</b></p><p><i className="card-dot"/> Transferencia / tarjeta <b>{money(card)}</b></p></article><article className="dash-card"><small>Desempeño operativo</small><h2>{filtered.length} pedidos</h2><div className="metric-line"><span>Pagados</span><b>{filtered.filter(o=>o.paid).length}</b></div><div className="metric-line"><span>Por cobrar</span><b>{filtered.filter(o=>!o.paid).length}</b></div><div className="metric-line"><span>Ticket promedio</span><b>{money(ticket)}</b></div></article></div>
    <section className="dash-card report-detail"><div className="card-title"><div><small>Detalle del reporte</small><h2>Ventas incluidas</h2></div><b>{filtered.length} registros</b></div>{filtered.length===0?<Empty text="No hay ventas en el periodo seleccionado"/>:<div className="report-table">{filtered.map(order=><div key={order.id}><b>#{order.id}</b><span>{orderDate(order)} · {order.createdAt}</span><strong>{order.customer}</strong><span>{order.payment}</span><span className={`status ${order.status.toLowerCase().replaceAll(' ','-')}`}>{order.status}</span><b>{money(order.total)}</b></div>)}</div>}</section>
  </div>
}

function PointOfSale({store,close}) {
  const products=store.products
  const settings=store.posSettings
  const today=(()=>{const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`})()
  const [step,setStep]=useState(1)
  const [lines,setLines]=useState([])
  const [serviceType,setServiceType]=useState('')
  const [customerData,setCustomerData]=useState({customer:'',phone:'',address:'',reference:'',deliveryFee:'0'})
  const [timing,setTiming]=useState('Ahora')
  const [scheduledDate,setScheduledDate]=useState(today)
  const [scheduledTime,setScheduledTime]=useState('')
  const [payment,setPayment]=useState('')
  const [cashTendered,setCashTendered]=useState('')
  const [cashConfirmed,setCashConfirmed]=useState(false)
  const [transferValidated,setTransferValidated]=useState(false)
  const [proof,setProof]=useState('')
  const [submitting,setSubmitting]=useState(false)
  const [result,setResult]=useState(null)
  const add=p=>setLines(rows=>rows.some(r=>r.id===p.id)?rows.map(r=>r.id===p.id?{...r,qty:r.qty+1}:r):[...rows,{...p,basePrice:p.price,price:p.price,qty:1,note:'',size:p.category==='Pizzas'?'Mediana':''}])
  const changeLineQty=(id,delta)=>setLines(rows=>rows.flatMap(line=>line.id!==id?[line]:line.qty+delta>0?[{...line,qty:line.qty+delta}]:[]))
  const updateLineNote=(id,note)=>setLines(rows=>rows.map(line=>line.id===id?{...line,note}:line))
  const updateLineSize=(id,size)=>setLines(rows=>rows.map(line=>line.id===id?{...line,size,price:pizzaPrice(line.basePrice||line.price,size)}:line))
  const changeServiceType=next=>{setServiceType(next);if(next==='Domicilio')setLines(rows=>rows.filter(line=>line.deliveryEnabled!==false))}
  const subtotal=lines.reduce((sum,line)=>sum+line.price*line.qty,0)
  const delivery=serviceType==='Domicilio'?Math.max(0,Number(customerData.deliveryFee)||0):0
  const total=subtotal+delivery
  const kitchenLines=lines.filter(line=>lineInStation(line,products,'Cocina'))
  const barLines=lines.filter(line=>lineInStation(line,products,'Barra'))
  const customerReady=customerData.customer.trim()&&(serviceType==='Recoger en restaurante'||(customerData.phone.trim()&&customerData.address.trim()))
  const scheduleSlots=useMemo(()=>{
    const [openHour,openMinute]=settings.openingTime.split(':').map(Number)
    const [closeHour,closeMinute]=settings.closingTime.split(':').map(Number)
    const start=openHour*60+openMinute
    const end=closeHour*60+closeMinute
    const now=new Date()
    const threshold=scheduledDate===today?now.getHours()*60+now.getMinutes()+Number(settings.prepMinutes):start
    const slots=[]
    for(let minute=start;minute<=end-Number(settings.prepMinutes);minute+=Number(settings.slotMinutes)){
      if(minute<threshold)continue
      const value=`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`
      const occupied=store.orders.filter(order=>order.scheduledDate===scheduledDate&&order.scheduledTime===value&&order.status!=='Cancelado').length
      if(occupied<Number(settings.slotCapacity))slots.push(value)
    }
    return slots
  },[settings,scheduledDate,store.orders,today])
  useEffect(()=>{if(timing==='Programar'&&!scheduleSlots.includes(scheduledTime))setScheduledTime(scheduleSlots[0]||'')},[timing,scheduleSlots,scheduledTime])
  const scheduleReady=timing==='Ahora'||(scheduledDate&&scheduledTime)
  const cashChange=Math.max(0,Number(cashTendered||0)-total)
  const paymentReady=payment==='Efectivo'
    ? cashConfirmed&&Number(cashTendered)>=total
    : payment==='Transferencia / Depósito'&&transferValidated
  const complete=()=>{
    if(submitting||!paymentReady)return
    setSubmitting(true)
    const scheduleLabel=timing==='Ahora'?'Ahora':`${scheduledDate} · ${scheduledTime}`
    const order=store.createOrder({
      customer:customerData.customer.trim(),
      phone:serviceType==='Domicilio'?customerData.phone.trim():'Mostrador',
      address:serviceType==='Domicilio'?customerData.address.trim():'',
      reference:serviceType==='Domicilio'?customerData.reference.trim():'',
      serviceType,
      lines:lines.map(({id,name,price,qty,note,size,station})=>({id,name,price,qty,note,size,station})),
      subtotal,
      delivery,
      total,
      payment,
      paid:true,
      paymentStatus:'Pagado',
      paymentProof:proof,
      cashTendered:payment==='Efectivo'?Number(cashTendered):undefined,
      change:payment==='Efectivo'?cashChange:0,
      timing,
      scheduledDate:timing==='Programar'?scheduledDate:'',
      scheduledTime:timing==='Programar'?scheduledTime:'',
      scheduleLabel,
    })
    const drawerOpened=requestCashDrawer(order,settings)
    if(settings.kitchenPrinterEnabled&&kitchenLines.length)printAreaDocument({title:'COMANDA DE COCINA',printer:settings.kitchenPrinter,order,lines:kitchenLines})
    if(settings.barPrinterEnabled&&barLines.length)setTimeout(()=>printAreaDocument({title:'COMANDA DE BARRA',printer:settings.barPrinter,order,lines:barLines}),350)
    setTimeout(()=>printAreaDocument({title:'TICKET DE VENTA',printer:settings.cashPrinter,order,lines,type:'sale'}),700)
    store.updateOrder(order.id,{drawerOpened,drawerOpenedAt:drawerOpened?new Date().toISOString():'',printLog:{cash:true,kitchen:settings.kitchenPrinterEnabled&&kitchenLines.length>0,bar:settings.barPrinterEnabled&&barLines.length>0}})
    notifyOrderByWhatsApp(order)
    setResult({...order,drawerOpened})
    setSubmitting(false)
    setStep(5)
  }
  const steps=['Productos','Entrega y cliente','Revisar cuenta','Pago']
  return <Modal title={step===5?'Venta confirmada':'Nueva venta en caja'} close={close} large>
    {step<5&&<div className="pos-stepper">{steps.map((label,index)=><button key={label} className={step===index+1?'active':step>index+1?'done':''} onClick={()=>index+1<step&&setStep(index+1)}><span>{step>index+1?<Check/>:index+1}</span>{label}</button>)}</div>}
    {step===1&&<div className="pos-layout"><div><span className="eyebrow">Paso 1</span><h2>Captura los productos</h2><div className="pos-products">{products.filter(product=>product.active&&(serviceType!=='Domicilio'||product.deliveryEnabled!==false)).map(product=><button key={product.id} onClick={()=>add(product)}><ProductMedia product={product}/><b>{product.name}</b><small>{money(product.price)}</small><em className={`area-tag ${product.station==='Ambas'?'both':''}`}>{product.station==='Ambas'?'Cocina + Barra':product.station}</em>{product.deliveryEnabled===false&&<em>Solo recoger</em>}</button>)}</div></div><aside><h3>Detalle de venta</h3>{lines.length===0?<Empty text="Selecciona productos"/>:lines.map(line=><div className="pos-line-wrap" key={line.id}><div className="pos-line"><div className="pos-qty"><button type="button" onClick={()=>changeLineQty(line.id,-1)}><Minus/></button><span>{line.qty}</span><button type="button" onClick={()=>changeLineQty(line.id,1)}><Plus/></button></div><b>{line.name}</b><strong>{money(line.price*line.qty)}</strong></div>{line.category==='Pizzas'&&<label className="pos-size">Tamaño<select value={line.size} onChange={e=>updateLineSize(line.id,e.target.value)}>{Object.keys(pizzaSizeAdjustments).map(size=><option key={size}>{size}</option>)}</select></label>}<input value={line.note||''} onChange={e=>updateLineNote(line.id,e.target.value)} placeholder="Indicaciones: sin salsa, sin cebolla..."/></div>)}<div className="pos-total"><span>Subtotal</span><b>{money(subtotal)}</b></div><button className="primary wide" disabled={!lines.length} onClick={()=>setStep(2)}>Continuar a entrega y cliente <ArrowRight/></button></aside></div>}
    {step===2&&<div className="pos-form-step"><span className="eyebrow">Paso 2</span><h2>Tipo de entrega y datos del cliente</h2><p>Primero selecciona cómo se entregará el pedido.</p><div className="service-options"><button className={serviceType==='Recoger en restaurante'?'active':''} onClick={()=>changeServiceType('Recoger en restaurante')}><ShoppingBag/> 🏪 Recoger en restaurante</button><button className={serviceType==='Domicilio'?'active':''} onClick={()=>changeServiceType('Domicilio')}><Bike/> 🛵 Entrega a domicilio</button></div>{serviceType&&<div className="form-grid pos-customer-form"><label className="full">Nombre del cliente<input value={customerData.customer} onChange={e=>setCustomerData({...customerData,customer:e.target.value})} placeholder="Nombre completo"/></label>{serviceType==='Domicilio'&&<><label>Teléfono<input value={customerData.phone} onChange={e=>setCustomerData({...customerData,phone:e.target.value})}/></label><label>Costo de envío<input type="number" min="0" value={customerData.deliveryFee} onChange={e=>setCustomerData({...customerData,deliveryFee:e.target.value})}/></label><label className="full">Dirección completa<input value={customerData.address} onChange={e=>setCustomerData({...customerData,address:e.target.value})} placeholder="Calle, número, colonia, ciudad"/></label><label className="full">Referencias de ubicación<input value={customerData.reference} onChange={e=>setCustomerData({...customerData,reference:e.target.value})} placeholder="Entre calles, color del portón, indicaciones"/></label></>}</div>}<div className="schedule-card"><h3>¿Para cuándo?</h3><div className="service-options"><button className={timing==='Ahora'?'active':''} onClick={()=>setTiming('Ahora')}><Clock3/> Ahora</button><button className={timing==='Programar'?'active':''} onClick={()=>setTiming('Programar')}><History/> Programar</button></div>{timing==='Programar'&&<div className="schedule-fields"><label>Fecha<input type="date" min={today} value={scheduledDate} onChange={e=>setScheduledDate(e.target.value)}/></label><label>Selecciona horario<select value={scheduledTime} onChange={e=>setScheduledTime(e.target.value)} disabled={!scheduleSlots.length}>{scheduleSlots.map(slot=><option key={slot}>{slot}</option>)}</select></label>{!scheduleSlots.length&&<p className="no-slots">No hay horarios disponibles para la fecha seleccionada.</p>}</div>}</div><div className="pos-form-actions"><button className="outline" onClick={()=>setStep(1)}>Volver</button><button className="primary" disabled={!serviceType||!customerReady||!scheduleReady} onClick={()=>setStep(3)}>Revisar cuenta <ArrowRight/></button></div></div>}
    {step===3&&<div className="sale-review"><section className="kitchen-print"><div className="ticket-logo">🔥 FUEGO</div><h2>RESUMEN DE LA ORDEN</h2><p className="ticket-meta">Todavía no se ha impreso ni enviado ninguna comanda</p><div className="ticket-customer"><small>CLIENTE</small><b>{customerData.customer}</b></div><div className="ticket-delivery"><b>{serviceType}</b><span>{serviceType==='Domicilio'?`${customerData.phone} · ${customerData.address}`:'Recoge en sucursal'}</span><span>{timing==='Ahora'?'Ahora':`${scheduledDate} · ${scheduledTime}`}</span></div><div className="ticket-lines">{lines.map(line=><article key={line.id}><b>{line.qty}× {line.name}{line.size?` · ${line.size}`:''}</b><span>{money(line.price*line.qty)}</span>{line.note&&<strong>INDICACIÓN: {line.note}</strong>}</article>)}</div><footer><span>Envío: {money(delivery)}</span><b>Total: {money(total)}</b></footer></section><aside className="review-actions"><span className="eyebrow">Paso 3</span><h2>Revisa la cuenta</h2><ol><li className="done"><Check/> {lines.reduce((sum,line)=>sum+line.qty,0)} productos capturados</li><li className="done"><Check/> {serviceType}</li><li className="done"><Check/> Cliente: {customerData.customer}</li><li><Printer/> La impresión ocurrirá después del cobro</li></ol><button className="primary wide" onClick={()=>setStep(4)}>Continuar al pago <ArrowRight/></button><button className="review-back" onClick={()=>setStep(2)}>Corregir datos</button></aside></div>}
    {step===4&&<div className="payment-step"><section><span className="eyebrow">Paso 4</span><h2>Confirmar pago</h2><div className="payment-total"><small>Total</small><strong>{money(total)}</strong></div><div className="payment-summary"><p><b>Tipo de entrega:</b> {serviceType==='Domicilio'?'🛵 Entrega a domicilio':'🏪 Recoger en restaurante'}</p><p><b>¿Para cuándo?</b> {timing==='Ahora'?'Ahora':`${scheduledDate} · ${scheduledTime}`}</p></div><h3>Método de pago</h3><div className="payment-options"><button className={payment==='Transferencia / Depósito'?'active':''} onClick={()=>{setPayment('Transferencia / Depósito');setCashConfirmed(false)}}><CreditCard/><span><b>💳 Transferencia / Depósito</b><small>Requiere validación</small></span>{payment==='Transferencia / Depósito'&&<Check/>}</button><button className={payment==='Efectivo'?'active':''} onClick={()=>{setPayment('Efectivo');setTransferValidated(false)}}><Wallet/><span><b>🤝 Efectivo</b><small>Cobro en caja</small></span>{payment==='Efectivo'&&<Check/>}</button></div>{payment==='Transferencia / Depósito'&&<div className="transfer-panel"><div><small>Titular</small><b>{settings.accountHolder}</b></div><div><small>Banco</small><b>{settings.bank}</b></div><div><small>Cuenta</small><b>{settings.accountNumber||'No configurada'}</b></div><div><small>CLABE</small><b>{settings.clabe||'No configurada'}</b></div>{settings.cardNumber&&<div><small>Tarjeta</small><b>{settings.cardNumber}</b></div>}{settings.paymentQr&&<img src={settings.paymentQr} alt="Código QR de pago"/>}<label className="full">Comprobante (opcional)<input type="file" accept="image/*,.pdf" onChange={e=>setProof(e.target.files?.[0]?.name||'')}/>{proof&&<small>Registrado: {proof}</small>}</label><div className="payment-validation"><span className={`status ${transferValidated?'entregado':'nuevo'}`}>{transferValidated?'Pagado':'Pendiente de validar'}</span><label className="inline-check"><input type="checkbox" checked={transferValidated} onChange={e=>setTransferValidated(e.target.checked)}/> Confirmo que el negocio validó la transferencia</label></div></div>}{payment==='Efectivo'&&<div className="cash-payment-panel"><label>Monto con el que paga<input type="number" min={total} value={cashTendered} onChange={e=>{setCashTendered(e.target.value);setCashConfirmed(false)}} placeholder={String(total)}/></label><div><small>Cambio a entregar</small><b>{money(cashChange)}</b></div><label className="inline-check"><input type="checkbox" checked={cashConfirmed} disabled={Number(cashTendered)<total} onChange={e=>setCashConfirmed(e.target.checked)}/> Confirmo que recibí el efectivo</label>{settings.cashDrawerEnabled&&!settings.cashDrawerCompatible&&<p className="drawer-warning">El cajón no se abrirá físicamente hasta marcarlo como compatible en Configuración POS.</p>}</div>}</section><aside className="payment-final"><h3>Al confirmar</h3><ol><li><CircleDollarSign/> Se registra la venta como Pagada</li><li><Wallet/> El cajón abre solo si el pago es efectivo</li><li><ChefHat/> Se envía la comanda de cocina</li><li><PackageCheck/> Se envía la comanda de barra</li><li><Printer/> Se imprime el ticket completo en caja</li></ol><button className="primary wide" disabled={!paymentReady||submitting} onClick={complete}>{submitting?'Procesando...':'Confirmar cobro y enviar pedido'} <ArrowRight/></button><button className="review-back" onClick={()=>setStep(3)}>Volver a revisar</button></aside></div>}
    {step===5&&result&&<div className="pos-success"><span><Check/></span><h2>Venta #{result.id} confirmada</h2><p>El pedido quedó <b>Pagado</b> y fue enviado a las áreas correspondientes.</p><div className="print-results"><article><Printer/><b>Ticket de caja</b><small>Enviado a {settings.cashPrinter}</small></article>{kitchenLines.length>0&&<article><ChefHat/><b>Comanda de cocina</b><small>{settings.kitchenPrinterEnabled?`Enviada a ${settings.kitchenPrinter}`:'Impresora desactivada'}</small></article>}{barLines.length>0&&<article><PackageCheck/><b>Comanda de barra</b><small>{settings.barPrinterEnabled?`Enviada a ${settings.barPrinter}`:'Impresora desactivada'}</small></article>}<article><Wallet/><b>Cajón de dinero</b><small>{payment!=='Efectivo'?'No aplica':result.drawerOpened?'Apertura solicitada':'Sin apertura física'}</small></article></div><button className="primary" onClick={close}>Finalizar</button></div>}
  </Modal>
}

function ProductionView({store}) {
  const [active,setActive]=useState('Producción')
  return <DashboardShell active={active} setActive={setActive} moduleItems={[[active,CookingPot]]} title="Cocina / Comandas" subtitle="Solo productos que requieren preparación en cocina."><ProductionBoard store={store}/></DashboardShell>
}

function BarView({store}) {
  const [active,setActive]=useState('Barra')
  return <DashboardShell active={active} setActive={setActive} moduleItems={[[active,PackageCheck]]} title="Barra / Despacho" subtitle="Productos listos o que no requieren pasar por cocina."><BarBoard store={store}/></DashboardShell>
}

function RealDeliveryMap({orders,selectedOrder,onSelect}) {
  const mapElement=useRef(null)
  const mapInstance=useRef(null)
  const orderLayer=useRef(null)
  const routeLayer=useRef(null)
  const locationMarker=useRef(null)
  const [location,setLocation]=useState(null)
  const [locationStatus,setLocationStatus]=useState('Solicitando ubicación del dispositivo…')

  useEffect(()=>{
    if(!mapElement.current||mapInstance.current)return
    const map=L.map(mapElement.current,{zoomControl:false}).setView([32.5149,-117.0382],12)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map)
    L.control.zoom({position:'topright'}).addTo(map)
    map.on('locationfound',event=>{
      const next={lat:event.latlng.lat,lng:event.latlng.lng,accuracy:event.accuracy,updatedAt:new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
      setLocation(next)
      setLocationStatus('Ubicación en tiempo real activa')
      const icon=L.divIcon({className:'leaflet-live-icon',html:'<span>●</span>',iconSize:[28,28],iconAnchor:[14,14]})
      if(locationMarker.current)locationMarker.current.setLatLng(event.latlng)
      else locationMarker.current=L.marker(event.latlng,{icon,zIndexOffset:1000}).addTo(map).bindTooltip('Tu ubicación actual')
    })
    map.on('locationerror',()=>setLocationStatus('No fue posible obtener la ubicación. Revisa el permiso GPS.'))
    mapInstance.current=map
    map.locate({watch:true,setView:true,maxZoom:16,enableHighAccuracy:true})
    return ()=>{map.stopLocate();map.remove();mapInstance.current=null}
  },[])

  useEffect(()=>{
    const map=mapInstance.current
    if(!map)return
    if(orderLayer.current)orderLayer.current.remove()
    orderLayer.current=L.layerGroup().addTo(map)
    const points=[]
    orders.forEach((order,index)=>{
      if(!order.coordinates)return
      points.push(order.coordinates)
      const selected=selectedOrder?.id===order.id
      const icon=L.divIcon({className:`leaflet-order-icon ${selected?'selected':''}`,html:`<span><b>${index+1}</b></span>`,iconSize:[38,38],iconAnchor:[19,38]})
      L.marker(order.coordinates,{icon}).addTo(orderLayer.current).bindTooltip(`#${order.id} · ${order.customer}`).on('click',()=>onSelect(order.id))
    })
    if(!location&&points.length)map.fitBounds(L.latLngBounds(points).pad(.18),{maxZoom:14})
  },[orders,selectedOrder,location,onSelect])

  useEffect(()=>{
    const map=mapInstance.current
    if(!map)return
    if(routeLayer.current)routeLayer.current.remove()
    const routePoints=[]
    if(location)routePoints.push([location.lat,location.lng])
    orders.filter(order=>order.coordinates).forEach(order=>routePoints.push(order.coordinates))
    if(routePoints.length>1)routeLayer.current=L.polyline(routePoints,{color:'#ff5a1f',weight:5,opacity:.78,dashArray:'10 10'}).addTo(map)
  },[orders,location])

  const centerLocation=()=>mapInstance.current?.locate({setView:true,maxZoom:16,enableHighAccuracy:true})
  const centerDestination=()=>selectedOrder?.coordinates&&mapInstance.current?.setView(selectedOrder.coordinates,16)
  return <div className="real-map-shell"><div className="real-map-search"><Navigation/><div><small>DESTINO SELECCIONADO</small><b>{selectedOrder?.address||'Selecciona una entrega'}</b></div></div><div ref={mapElement} className="leaflet-delivery-map"/><div className="real-map-status"><div><span className={location?'gps-live':'gps-off'}><Crosshair/></span><div><small>{locationStatus}</small><b>{location?`${location.lat.toFixed(5)}, ${location.lng.toFixed(5)} · ±${Math.round(location.accuracy)} m`:'Centro inicial: Tijuana, B.C.'}</b>{location&&<em>Actualizado {location.updatedAt}</em>}</div></div><div className="real-map-actions"><button onClick={centerLocation}><LocateFixed/> Mi ubicación</button><button onClick={centerDestination} disabled={!selectedOrder}><MapPin/> Ver destino</button>{selectedOrder&&<a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedOrder.address)}`} target="_blank" rel="noreferrer"><Navigation/> Navegar</a>}</div></div></div>
}

function DriverView({store}) {
  const [tab,setTab]=useState('Por entregar')
  const [selectedStop,setSelectedStop]=useState(null)
  const deliveryOrders=store.orders.filter(o=>isDeliveryOrder(o)&&o.driver==='Roberto Gómez')
  const activeOrders=deliveryOrders.filter(o=>['Nuevo','En barra','En cocina','Listo','En preparación','Listo para enviar','Asignado','Asignado a repartidor','En ruta'].includes(o.status))
  const history=deliveryOrders.filter(o=>o.status==='Entregado')
  const positions=[['24%','24%'],['67%','19%'],['77%','61%'],['38%','70%'],['53%','43%']]
  const selectedOrder=activeOrders.find(order=>order.id===selectedStop)||activeOrders.find(order=>order.status==='En ruta')||activeOrders[0]
  const advance=order=>{
    if(['En cocina','En preparación'].includes(order.status))return
    const status=['Listo','Listo para enviar','Asignado','Asignado a repartidor'].includes(order.status)?'En ruta':'Entregado'
    store.updateOrder(order.id,{status,driver:'Roberto Gómez',paid:status==='Entregado'?true:order.paid})
  }
  return <main className="driver-view driver-portal"><section className="driver-top"><div><span className="eyebrow">Servicio a domicilio · Turno activo</span><h1>Portal repartidor</h1><p>Hola, Roberto. Tienes {activeOrders.length} servicios por completar.</p></div><div className="driver-score"><Star fill="currentColor"/><b>4.96</b><small>Calificación</small></div></section>
    <nav className="driver-nav">{[['Por entregar',PackageCheck],['Ruta en mapa',Navigation],['Historial',History]].map(([label,Icon])=><button key={label} className={tab===label?'active':''} onClick={()=>setTab(label)}><Icon/> {label}{label==='Por entregar'&&<span>{activeOrders.length}</span>}</button>)}</nav>
    {tab==='Por entregar'&&<section className="delivery-queue"><div className="queue-heading"><div><small>DOMICILIO</small><h2>Lista de entregas</h2></div><div className="queue-counters"><span><i className="cooking"/> En preparación {activeOrders.filter(o=>['Nuevo','En barra','En cocina','En preparación'].includes(o.status)).length}</span><span><i className="route"/> En ruta {activeOrders.filter(o=>o.status==='En ruta').length}</span><span><i className="ready"/> Asignados {activeOrders.filter(o=>['Listo','Listo para enviar','Asignado','Asignado a repartidor'].includes(o.status)).length}</span></div></div>{activeOrders.length===0?<Empty text="No tienes entregas pendientes"/>:<div className="delivery-cards">{activeOrders.map((order,index)=><article key={order.id}><div className="delivery-card-head"><div><small>#{order.id}</small><h3>{order.customer}</h3></div><span className={`status ${order.status.toLowerCase().replaceAll(' ','-')}`}>{order.status}</span></div><div className="address-preview"><div className="mini-map"><span style={{left:positions[index%positions.length][0],top:positions[index%positions.length][1]}}><MapPin/></span></div><p><MapPin/> {order.address}</p></div><div className="delivery-meta"><span><PackageCheck/> {lineText(order)}</span><b>{money(order.total)}</b></div><div className="delivery-actions"><a href={`tel:${order.phone}`}><Phone/> Llamar</a><a href={`sms:${order.phone}`}><MessageCircle/> Contactar</a><a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.address)}`} target="_blank" rel="noreferrer"><Navigation/> Navegar</a></div>{['Listo','Listo para enviar','Asignado','Asignado a repartidor','En ruta'].includes(order.status)?<button className="primary wide" onClick={()=>advance(order)}>{order.status==='En ruta'?'Confirmar entrega':'Iniciar ruta'} <ArrowRight/></button>:<small className="delivery-waiting"><CookingPot/> Esperando preparación del pedido</small>}</article>)}</div>}</section>}
    {tab==='Ruta en mapa'&&<section className="driver-route-layout"><div className="map-card route-map"><RealDeliveryMap orders={activeOrders} selectedOrder={selectedOrder} onSelect={setSelectedStop}/></div><aside className="route-stops"><small>ORDEN DE ENTREGA</small><h2>Paradas de la ruta</h2>{activeOrders.map((order,index)=><button className={selectedOrder?.id===order.id?'selected':''} key={order.id} onClick={()=>setSelectedStop(order.id)}><span>{index+1}</span><div><b>{order.customer}</b><small>{order.address}</small></div><strong className={`status ${order.status.toLowerCase().replaceAll(' ','-')}`}>{order.status}</strong></button>)}</aside></section>}
    {tab==='Historial'&&<section className="dash-card driver-history"><div className="card-title"><div><small>Servicios completados</small><h2>Historial de entregas</h2></div><b>{history.length} entregas</b></div>{history.length===0?<Empty text="Todavía no hay entregas completadas"/>:history.map(order=><article key={order.id}><span><Check/></span><div><b>#{order.id} · {order.customer}</b><small><MapPin/> {order.address}</small></div><strong>{money(order.total)}</strong><span className="status entregado">Entregado</span></article>)}</section>}
  </main>
}

function Modal({title,close,children,large}) {return <div className="overlay modal-overlay"><div className={`modal ${large?'large':''}`}><div className="panel-head"><h2>{title}</h2><button onClick={close}><X/></button></div>{children}</div></div>}
function Empty({text}){return <div className="empty compact-empty"><ShoppingBag/><h3>{text}</h3></div>}

export default function App(){
  const store=useRestaurantStore()
  const savedRole=localStorage.getItem('fuego-active-role')
  const [role,setRoleState]=useState(savedRole||'cliente'),[sessionOpen,setSessionOpen]=useState(!savedRole),[cart,setCart]=useState([]),[showCart,setShowCart]=useState(false)
  const setRole=nextRole=>{localStorage.setItem('fuego-active-role',nextRole);setRoleState(nextRole)}
  const cartCount=useMemo(()=>cart.reduce((n,row)=>n+row.qty,0),[cart])
  const addItem=product=>{setCart(rows=>rows.some(r=>r.id===product.id)?rows.map(r=>r.id===product.id?{...r,qty:r.qty+1}:r):[...rows,{...product,basePrice:product.price,qty:1,note:'',size:product.category==='Pizzas'?'Mediana':''}]);setShowCart(true)}
  const changeQty=(id,delta)=>setCart(rows=>rows.flatMap(row=>row.id!==id?[row]:row.qty+delta>0?[{...row,qty:row.qty+delta}]:[]))
  const updateNote=(id,note)=>setCart(rows=>rows.map(row=>row.id===id?{...row,note}:row))
  const updateSize=(id,size)=>setCart(rows=>rows.map(row=>row.id===id?{...row,size,price:pizzaPrice(row.basePrice||row.price,size)}:row))
  const createOrder=payload=>{const order=store.createOrder(payload);setCart([]);return order}
  return <div className="app"><Header role={role} openSessions={()=>setSessionOpen(true)} cartCount={cartCount} onCart={()=>setShowCart(true)}/>{sessionOpen&&<SessionSelector role={role} setRole={setRole} close={()=>setSessionOpen(false)}/>} {role==='cliente'&&<CustomerView products={store.products} cart={cart} addItem={addItem} changeQty={changeQty} updateNote={updateNote} updateSize={updateSize} showCart={showCart} setShowCart={setShowCart} createOrder={createOrder}/>} {role==='administrador'&&<AdminView store={store}/>} {role==='cajero'&&<CashierView store={store}/>} {role==='produccion'&&<ProductionView store={store}/>} {role==='barra'&&<BarView store={store}/>} {role==='repartidor'&&<DriverView store={store}/>}</div>
}
