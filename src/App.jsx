import { useMemo, useState } from 'react'
import {
  ArrowRight, BarChart3, Bike, Check, ChefHat, ChevronRight, CircleDollarSign,
  Clock3, CookingPot, CreditCard, Edit3, LayoutDashboard, Map, MapPin,
  MessageCircle, Minus, PackageCheck, Phone, Plus, Search, ShieldCheck,
  ShoppingBag, Sparkles, Star, Store, Trash2, UserPlus, Users, Wallet, X,
} from 'lucide-react'
import { useRestaurantStore } from './store'

const money = value => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value)
const lineText = order => order.lines.map(line => `${line.qty} ${line.name}`).join(' · ')
const WHATSAPP_TEST_NUMBER = '526645812107'

function notifyOrderByWhatsApp(order) {
  const products = order.lines
    .map(line => `• ${line.qty} x ${line.name} — ${money(line.price * line.qty)}`)
    .join('\n')
  const message = [
    '🔥 *NUEVO PEDIDO FUEGO*',
    `*Folio:* #${order.id}`,
    `*Cliente:* ${order.customer}`,
    `*Teléfono:* ${order.phone}`,
    `*Dirección:* ${order.address}`,
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
  cliente: { label: 'Cliente', icon: ShoppingBag, subtitle: 'Ordena algo delicioso' },
  administrador: { label: 'Administrador', icon: LayoutDashboard, subtitle: 'Control del restaurante' },
  produccion: { label: 'Producción', icon: ChefHat, subtitle: 'Cocina y comandas' },
  repartidor: { label: 'Repartidor', icon: Bike, subtitle: 'Tus entregas de hoy' },
}

function ProductMedia({ product, className = '' }) {
  return product.image
    ? <img className={`product-photo ${className}`} src={product.image} alt={product.name}/>
    : <span className={className}>{product.emoji || '🍽️'}</span>
}

function RolePicker({ role, setRole }) {
  const [open, setOpen] = useState(false)
  const CurrentIcon = roles[role].icon
  return <div className="role-picker">
    <button className="role-current" onClick={() => setOpen(!open)} aria-expanded={open}>
      <span className="avatar"><CurrentIcon size={18}/></span><span><small>Vista actual</small><strong>{roles[role].label}</strong></span><ChevronRight size={17} className={open ? 'rotate' : ''}/>
    </button>
    {open && <div className="role-menu"><p>Cambiar experiencia</p>{Object.entries(roles).map(([key,item]) => { const Icon=item.icon; return <button key={key} className={key===role?'selected':''} onClick={()=>{setRole(key);setOpen(false)}}><Icon size={18}/><span><strong>{item.label}</strong><small>{item.subtitle}</small></span>{key===role&&<Check size={16}/>}</button>})}</div>}
  </div>
}

function Header({ role, setRole, cartCount, onCart }) {
  return <header>
    <a className="brand" href="#inicio"><span className="brand-mark">🔥</span><span>FUEGO<small>restaurant + delivery</small></span></a>
    <nav><a href="#inicio">Inicio</a><a href="#menu">Menú</a><a href="#pedidos">Pedidos</a></nav>
    <div className="header-actions"><RolePicker role={role} setRole={setRole}/>{role==='cliente'&&<button className="cart-button" onClick={onCart} aria-label="Abrir carrito"><ShoppingBag size={20}/><span>{cartCount}</span></button>}</div>
  </header>
}

function CustomerView({ products, cart, addItem, changeQty, showCart, setShowCart, createOrder }) {
  const [category,setCategory]=useState('Todos')
  const [query,setQuery]=useState('')
  const categories=['Todos',...new Set(products.filter(p=>p.active).map(p=>p.category))]
  const visible=products.filter(p=>p.active&&(category==='Todos'||p.category===category)&&p.name.toLowerCase().includes(query.toLowerCase()))
  return <>
    <main className="customer" id="inicio">
      <section className="hero"><div className="hero-copy"><span className="eyebrow"><Sparkles size={15}/> Sabor local, directo a tu puerta</span><h1>Tu antojo merece llegar <em>caliente.</em></h1><p>Ingredientes frescos, cocina honesta y entregas que puedes seguir en tiempo real.</p><div className="hero-actions"><a className="primary" href="#menu">Ver el menú <ArrowRight size={18}/></a><span><Clock3 size={18}/><b>25–35 min</b><small>tiempo estimado</small></span></div></div><div className="hero-art"><div className="dish">🌮<span>🔥</span></div><div className="float-card top"><span>🛵</span><p><b>Entrega rápida</b><small>Seguimiento en vivo</small></p></div><div className="float-card bottom"><span>⭐</span><p><b>4.9 de 5</b><small>El favorito del barrio</small></p></div></div></section>
      <section className="menu-section" id="menu"><div className="section-heading"><div><span className="eyebrow">Nuestro menú</span><h2>Favoritos de la casa</h2></div><label className="search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar platillo"/></label></div>
        <div className="categories">{categories.map(item=><button key={item} className={category===item?'active':''} onClick={()=>setCategory(item)}>{item}</button>)}</div>
        <div className="product-grid">{visible.map(product=><article className="product-card" key={product.id}><div className={`product-image ${product.tone}`}><ProductMedia product={product}/><b><Star size={13} fill="currentColor"/> 4.9</b></div><div className="product-info"><small>{product.category}</small><h3>{product.name}</h3><p>{product.desc}</p><footer><strong>{money(product.price)}</strong><button onClick={()=>addItem(product)} aria-label={`Agregar ${product.name}`}><Plus size={19}/></button></footer></div></article>)}</div>
      </section>
    </main>
    {showCart&&<Checkout cart={cart} changeQty={changeQty} close={()=>setShowCart(false)} createOrder={createOrder}/>}
  </>
}

function Checkout({ cart, changeQty, close, createOrder }) {
  const [step,setStep]=useState('cart')
  const [payment,setPayment]=useState('Efectivo')
  const [form,setForm]=useState({customer:'',phone:'',address:'',reference:'',changeFor:''})
  const [result,setResult]=useState(null)
  const subtotal=cart.reduce((sum,row)=>sum+row.price*row.qty,0), delivery=39, total=subtotal+delivery
  const valid=form.customer.trim()&&form.phone.trim()&&form.address.trim()
  const confirm=()=>{const order=createOrder({...form,lines:cart.map(({id,name,price,qty})=>({id,name,price,qty})),subtotal,delivery,total,payment,paid:payment==='Tarjeta'});notifyOrderByWhatsApp(order);setResult(order);setStep('done')}
  return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&close()}><aside className="cart-panel">
    <div className="panel-head"><div><small>Pedido a domicilio</small><h2>{step==='cart'?'Tu bolsa':step==='checkout'?'Finalizar pedido':'¡Pedido confirmado!'}</h2></div><button onClick={close} aria-label="Cerrar"><X/></button></div>
    {step==='cart'&&<><div className="cart-list">{cart.length===0?<div className="empty"><ShoppingBag/><h3>Tu bolsa está vacía</h3></div>:cart.map(row=><div className="cart-row" key={row.id}><span className={`mini ${row.tone}`}>{row.emoji}</span><div><b>{row.name}</b><small>{money(row.price)}</small></div><div className="qty"><button onClick={()=>changeQty(row.id,-1)}><Minus size={14}/></button><span>{row.qty}</span><button onClick={()=>changeQty(row.id,1)}><Plus size={14}/></button></div></div>)}</div>{cart.length>0&&<OrderTotal subtotal={subtotal} delivery={delivery} total={total}><button className="primary wide" onClick={()=>setStep('checkout')}>Continuar <ArrowRight size={18}/></button></OrderTotal>}</>}
    {step==='checkout'&&<div className="checkout-form"><div className="step-title"><span>1</span><h3>Datos de entrega</h3></div><div className="form-grid"><label>Nombre completo<input value={form.customer} onChange={e=>setForm({...form,customer:e.target.value})} placeholder="¿Quién recibe?"/></label><label>Teléfono<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="33 1234 5678"/></label><label className="full">Dirección<input value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="Calle, número, colonia"/></label><label className="full">Referencia<input value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})} placeholder="Portón, entre calles, indicaciones"/></label></div>
      <div className="step-title"><span>2</span><h3>Método de pago</h3></div><div className="payment-options"><button className={payment==='Efectivo'?'active':''} onClick={()=>setPayment('Efectivo')}><Wallet/><span><b>Efectivo</b><small>Paga al recibir</small></span>{payment==='Efectivo'&&<Check/>}</button><button className={payment==='Tarjeta'?'active':''} onClick={()=>setPayment('Tarjeta')}><CreditCard/><span><b>Tarjeta</b><small>Pago seguro</small></span>{payment==='Tarjeta'&&<Check/>}</button></div>
      {payment==='Efectivo'&&<label className="change-field">¿Con cuánto pagarás?<input type="number" value={form.changeFor} onChange={e=>setForm({...form,changeFor:e.target.value})} placeholder={`Mínimo ${total}`}/></label>}
      {payment==='Tarjeta'&&<div className="card-note"><ShieldCheck/> Demo: la tarjeta se marca como pagada. En producción se conectará una pasarela segura.</div>}
      <OrderTotal subtotal={subtotal} delivery={delivery} total={total}><button className="primary wide" disabled={!valid} onClick={confirm}>Confirmar y enviar por WhatsApp <ArrowRight size={18}/></button><small className="whatsapp-note"><MessageCircle size={14}/> También se registra en cocina y administración</small></OrderTotal></div>}
    {step==='done'&&<div className="success"><span><Check size={36}/></span><h3>Ya recibimos tu pedido</h3><p>Pedido <b>#{result.id}</b> · Pago en <b>{result.payment.toLowerCase()}</b>.</p><div className="tracking"><i className="done"/><i className="active"/><i/><small>Confirmado</small><small>Producción</small><small>En camino</small></div><button className="primary wide" onClick={close}>Cerrar</button></div>}
  </aside></div>
}

function OrderTotal({subtotal,delivery,total,children}){return <div className="checkout"><p><span>Subtotal</span><b>{money(subtotal)}</b></p><p><span>Envío</span><b>{money(delivery)}</b></p><p className="total"><span>Total</span><b>{money(total)}</b></p>{children}</div>}

const modules=[['Resumen',LayoutDashboard],['Pedidos',ShoppingBag],['Producción',CookingPot],['Reparto',Bike],['Productos',Store],['Clientes',Users],['Reportes',BarChart3]]
function DashboardShell({active,setActive,children,onNewSale,title='Centro de operación',subtitle='Todo tu restaurante en un solo lugar.'}) {
  return <main className="app-shell"><aside className="sidebar"><div className="side-brand">🔥</div>{modules.map(([label,Icon])=><button className={active===label?'active':''} key={label} onClick={()=>setActive(label)}><Icon/><span>{label}</span></button>)}</aside><div className="workspace"><div className="workspace-head"><div><span className="eyebrow">Panel de control</span><h1>{title}</h1><p>{subtitle}</p></div><button className="outline" onClick={onNewSale}><Plus/> Nueva venta</button></div>{children}</div></main>
}

function AdminView({store, initialActive = 'Resumen'}) {
  const [active,setActive]=useState(initialActive)
  const [saleOpen,setSaleOpen]=useState(false)
  return <DashboardShell active={active} setActive={setActive} onNewSale={()=>setSaleOpen(true)} title={active} subtitle="Información sincronizada con cocina y reparto.">
    {active==='Resumen'&&<Summary store={store}/>}
    {active==='Pedidos'&&<OrdersModule store={store}/>}
    {active==='Producción'&&<ProductionBoard store={store}/>}
    {active==='Reparto'&&<DispatchModule store={store}/>}
    {active==='Productos'&&<ProductsModule store={store}/>}
    {active==='Clientes'&&<CustomersModule customers={store.customers}/>}
    {active==='Reportes'&&<ReportsModule store={store}/>}
    {saleOpen&&<PointOfSale products={store.products} createOrder={store.createOrder} close={()=>setSaleOpen(false)}/>}
  </DashboardShell>
}

function Summary({store}) {
  const sales=store.orders.reduce((sum,o)=>sum+o.total,0), active=store.orders.filter(o=>!['Entregado','Cancelado'].includes(o.status)).length
  const stats=[['Ventas registradas',money(sales),CircleDollarSign,'orange'],['Pedidos',store.orders.length,ShoppingBag,'blue'],['En proceso',active,CookingPot,'green'],['Clientes',store.customers.length,Users,'purple']]
  return <><div className="stats">{stats.map(([label,value,Icon,tone])=><article key={label}><span className={tone}><Icon/></span><small>{label}</small><h3>{value}</h3><p>Actualizado ahora</p></article>)}</div><section className="dash-card orders-card module-space"><div className="card-title"><div><small>Operación en vivo</small><h2>Pedidos recientes</h2></div></div>{store.orders.slice(0,5).map(order=><OrderRow order={order} key={order.id}/>)}</section></>
}

function OrderRow({order}){return <div className="order-row"><span className="order-icon"><ShoppingBag/></span><div><b>#{order.id}</b><small>{order.customer} · {lineText(order)}</small></div><b>{money(order.total)}</b><span className={`status ${order.status.toLowerCase().replaceAll(' ','-')}`}>{order.status}</span><small>{order.createdAt}</small></div>}

function OrdersModule({store}) {
  return <section className="dash-card data-card"><div className="card-title"><div><small>Todos los canales</small><h2>Pedidos y ventas</h2></div></div><div className="data-table">{store.orders.map(order=><div className="data-row order-data" key={order.id}><b>#{order.id}</b><div><strong>{order.customer}</strong><small>{lineText(order)}</small></div><span>{order.payment}<small>{order.paid?'Pagado':'Cobrar al entregar'}</small></span><b>{money(order.total)}</b><select value={order.status} onChange={e=>store.updateOrder(order.id,{status:e.target.value})}>{['Nuevo','En cocina','Listo','Asignado','En ruta','Entregado','Cancelado'].map(s=><option key={s}>{s}</option>)}</select></div>)}</div></section>
}

function ProductionBoard({store}) {
  const visible=store.orders.filter(o=>!['Entregado','Cancelado'].includes(o.status))
  const advance=order=>store.updateOrder(order.id,{status:order.status==='Nuevo'?'En cocina':'Listo'})
  return <div className="kanban">{['Nuevo','En cocina','Listo'].map(state=><section key={state}><header><h2>{state}</h2><span>{visible.filter(o=>o.status===state).length}</span></header>{visible.filter(o=>o.status===state).map(order=><article className="ticket" key={order.id}><div><b>#{order.id}</b><span><Clock3/> {order.createdAt}</span></div><h3>{lineText(order)}</h3><p><strong>Cliente:</strong> {order.customer}</p>{state!=='Listo'&&<footer><span>{order.payment}</span><button onClick={()=>advance(order)}>{state==='Nuevo'?'Aceptar':'Marcar listo'} <Check/></button></footer>}</article>)}</section>)}</div>
}

function DispatchModule({store}) {
  const orders=store.orders.filter(o=>['Listo','Asignado','En ruta'].includes(o.status))
  return <section className="dash-card data-card"><div className="card-title"><div><small>Última milla</small><h2>Asignación de reparto</h2></div></div>{orders.length===0?<Empty text="No hay pedidos listos para reparto"/>:<div className="delivery-list">{orders.map(order=><article key={order.id}><div><span className="order-icon"><Bike/></span><div><b>#{order.id} · {order.customer}</b><small><MapPin/> {order.address}</small></div></div><div><select value={order.driver} onChange={e=>store.updateOrder(order.id,{driver:e.target.value,status:e.target.value?'Asignado':'Listo'})}><option value="">Sin asignar</option><option>Roberto Gómez</option><option>Luis Fernando Ruiz</option></select><span className={`status ${order.status.toLowerCase().replace(' ','-')}`}>{order.status}</span></div></article>)}</div>}</section>
}

function ProductsModule({store}) {
  const categories=['Tacos','Hamburguesas','Pizzas','Especiales','Bebidas','Postres']
  const empty={name:'',desc:'',price:'',category:'Tacos',emoji:'🍽️',image:'',active:true}
  const [editing,setEditing]=useState(null)
  const save=()=>{if(editing.name&&Number(editing.price)>0){store.saveProduct({...editing,price:Number(editing.price)});setEditing(null)}}
  const loadImage=file=>{if(!file)return;if(file.size>1500000){alert('La imagen debe pesar menos de 1.5 MB.');return}const reader=new FileReader();reader.onload=()=>setEditing(current=>({...current,image:reader.result}));reader.readAsDataURL(file)}
  return <><div className="module-toolbar"><p>{store.products.length} productos registrados</p><button className="primary" onClick={()=>setEditing(empty)}><Plus/> Nuevo producto</button></div><div className="product-admin-grid">{store.products.map(product=><article key={product.id}><span className={product.tone}><ProductMedia product={product}/></span><div><small>{product.category}</small><h3>{product.name}</h3><b>{money(product.price)}</b></div><label className="switch"><input type="checkbox" checked={product.active} onChange={()=>store.saveProduct({...product,active:!product.active})}/><i/></label><button className="icon-edit" onClick={()=>setEditing(product)}><Edit3/></button></article>)}</div>{editing&&<Modal title={editing.id?'Editar producto':'Nuevo producto'} close={()=>setEditing(null)}><div className="form-grid"><label>Nombre<input value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})}/></label><label>Precio<input type="number" value={editing.price} onChange={e=>setEditing({...editing,price:e.target.value})}/></label><label>Categoría<select value={editing.category} onChange={e=>setEditing({...editing,category:e.target.value})}>{categories.map(category=><option key={category} value={category}>{category}</option>)}</select></label><label>Emoji de respaldo<input value={editing.emoji} onChange={e=>setEditing({...editing,emoji:e.target.value})}/></label><label className="full image-field">Imagen del producto<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>loadImage(e.target.files?.[0])}/><small>PNG, JPG o WebP · máximo 1.5 MB</small>{editing.image&&<div className="image-preview"><img src={editing.image} alt="Vista previa"/><button type="button" onClick={()=>setEditing({...editing,image:''})}><Trash2/> Quitar imagen</button></div>}</label><label className="full">Descripción<input value={editing.desc} onChange={e=>setEditing({...editing,desc:e.target.value})}/></label></div><button className="primary wide modal-save" onClick={save}>Guardar producto</button></Modal>}</>
}

function CustomersModule({customers}) {
  const [query,setQuery]=useState('');const visible=customers.filter(c=>`${c.name} ${c.phone}`.toLowerCase().includes(query.toLowerCase()))
  return <section className="dash-card data-card"><div className="module-toolbar"><label className="search"><Search/><input placeholder="Buscar cliente" value={query} onChange={e=>setQuery(e.target.value)}/></label><b>{visible.length} clientes</b></div><div className="customer-list">{visible.map(customer=><article key={customer.id}><span>{customer.name.split(' ').map(x=>x[0]).join('').slice(0,2)}</span><div><b>{customer.name}</b><small>{customer.phone}</small></div><div><small>Dirección</small><p>{customer.address}</p></div><div><b>{customer.orders}</b><small>pedidos</small></div><div><b>{money(customer.total)}</b><small>consumo</small></div></article>)}</div></section>
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
  const card=filtered.filter(o=>o.payment==='Tarjeta').reduce((s,o)=>s+o.total,0)
  const total=cash+card
  const ticket=filtered.length?total/filtered.length:0
  const rangeLabel=period==='turno'?`${referenceDate} · ${shift}`:rangeStart===rangeEnd?rangeStart:`${rangeStart} al ${rangeEnd}`
  return <div className="reports-module">
    <section className="dash-card report-filters"><div><small>Tipo de reporte</small><h2>Ventas por periodo</h2></div><div className="report-controls"><label>Vista<select value={period} onChange={e=>setPeriod(e.target.value)}><option value="turno">Por turno</option><option value="diaria">Diaria</option><option value="semanal">Semanal</option><option value="mensual">Mensual</option><option value="periodo">Periodo personalizado</option></select></label>{['turno','diaria','semanal'].includes(period)&&<label>Fecha de referencia<input type="date" value={referenceDate} onChange={e=>setReferenceDate(e.target.value)}/></label>}{period==='turno'&&<label>Turno<select value={shift} onChange={e=>setShift(e.target.value)}><option>Matutino</option><option>Vespertino</option><option>Nocturno</option></select></label>}{period==='mensual'&&<label>Mes<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label>}{period==='periodo'&&<><label>Desde<input type="date" value={from} max={to} onChange={e=>setFrom(e.target.value)}/></label><label>Hasta<input type="date" value={to} min={from} onChange={e=>setTo(e.target.value)}/></label></>}</div><p className="range-label"><Clock3/> Mostrando: <b>{rangeLabel}</b></p></section>
    <div className="report-summary"><article><small>Venta total</small><h3>{money(total)}</h3></article><article><small>Pedidos</small><h3>{filtered.length}</h3></article><article><small>Ticket promedio</small><h3>{money(ticket)}</h3></article><article><small>Entregados</small><h3>{filtered.filter(o=>o.status==='Entregado').length}</h3></article></div>
    <div className="report-grid"><article className="dash-card"><small>Ventas por método</small><h2>{money(total)}</h2><div className="payment-bar"><span style={{width:`${total?(cash/total)*100:0}%`}}/></div><p><i className="cash-dot"/> Efectivo <b>{money(cash)}</b></p><p><i className="card-dot"/> Tarjeta <b>{money(card)}</b></p></article><article className="dash-card"><small>Desempeño operativo</small><h2>{filtered.length} pedidos</h2><div className="metric-line"><span>Pagados</span><b>{filtered.filter(o=>o.paid).length}</b></div><div className="metric-line"><span>Por cobrar</span><b>{filtered.filter(o=>!o.paid).length}</b></div><div className="metric-line"><span>Ticket promedio</span><b>{money(ticket)}</b></div></article></div>
    <section className="dash-card report-detail"><div className="card-title"><div><small>Detalle del reporte</small><h2>Ventas incluidas</h2></div><b>{filtered.length} registros</b></div>{filtered.length===0?<Empty text="No hay ventas en el periodo seleccionado"/>:<div className="report-table">{filtered.map(order=><div key={order.id}><b>#{order.id}</b><span>{orderDate(order)} · {order.createdAt}</span><strong>{order.customer}</strong><span>{order.payment}</span><span className={`status ${order.status.toLowerCase().replaceAll(' ','-')}`}>{order.status}</span><b>{money(order.total)}</b></div>)}</div>}</section>
  </div>
}

function PointOfSale({products,createOrder,close}) {
  const [lines,setLines]=useState([]),[payment,setPayment]=useState('Efectivo'),[customer,setCustomer]=useState('Venta mostrador')
  const add=p=>setLines(rows=>rows.some(r=>r.id===p.id)?rows.map(r=>r.id===p.id?{...r,qty:r.qty+1}:r):[...rows,{...p,qty:1}])
  const subtotal=lines.reduce((s,r)=>s+r.price*r.qty,0)
  const complete=()=>{const order=createOrder({customer,phone:'Mostrador',address:'Recoge en sucursal',lines:lines.map(({id,name,price,qty})=>({id,name,price,qty})),subtotal,delivery:0,total:subtotal,payment,paid:true,status:'Nuevo'});notifyOrderByWhatsApp(order);close()}
  return <Modal title="Nueva venta en caja" close={close} large><div className="pos-layout"><div><label className="field-label">Cliente<input value={customer} onChange={e=>setCustomer(e.target.value)}/></label><div className="pos-products">{products.filter(p=>p.active).map(p=><button key={p.id} onClick={()=>add(p)}><ProductMedia product={p}/><b>{p.name}</b><small>{money(p.price)}</small></button>)}</div></div><aside><h3>Detalle de venta</h3>{lines.length===0?<Empty text="Selecciona productos"/>:lines.map(line=><div className="pos-line" key={line.id}><span>{line.qty}×</span><b>{line.name}</b><strong>{money(line.price*line.qty)}</strong></div>)}<div className="pos-total"><span>Total</span><b>{money(subtotal)}</b></div><div className="payment-options compact"><button className={payment==='Efectivo'?'active':''} onClick={()=>setPayment('Efectivo')}><Wallet/> Efectivo</button><button className={payment==='Tarjeta'?'active':''} onClick={()=>setPayment('Tarjeta')}><CreditCard/> Tarjeta</button></div><button className="primary wide" disabled={!lines.length} onClick={complete}>Cobrar y notificar por WhatsApp</button></aside></div></Modal>
}

function ProductionView({store}){return <AdminView store={store} initialActive="Producción"/>}

function DriverView({store}) {
  const assigned=store.orders.filter(o=>o.driver==='Roberto Gómez'&&['Asignado','En ruta'].includes(o.status))
  const order=assigned[0]
  if(!order)return <main className="driver-view"><div className="driver-top"><div><span className="eyebrow">Turno activo</span><h1>Hola, Roberto 👋</h1></div></div><Empty text="No tienes entregas asignadas por ahora."/></main>
  const next=()=>store.updateOrder(order.id,{status:order.status==='Asignado'?'En ruta':'Entregado',paid:true})
  return <main className="driver-view"><section className="driver-top"><div><span className="eyebrow">Turno activo · {assigned.length} entregas</span><h1>Hola, Roberto 👋</h1><p>Tu siguiente entrega está lista.</p></div><div className="driver-score"><Star fill="currentColor"/><b>4.96</b><small>Calificación</small></div></section><div className="driver-grid"><section className="map-card"><div className="map-ui"><div className="route-line"/><span className="pin restaurant"><Store/></span><span className="pin destination"><MapPin/></span><span className="rider">🛵</span><div className="map-label">12 min · 3.4 km</div></div></section><section className="delivery-card"><div className="delivery-head"><div><small>Siguiente entrega</small><h2>#{order.id}</h2></div><span className="status listo">{order.status}</span></div><div className="customer-block"><span>{order.customer.split(' ').map(x=>x[0]).join('').slice(0,2)}</span><div><h3>{order.customer}</h3><p><MapPin/> {order.address}</p></div></div><div className="delivery-actions"><a href={`tel:${order.phone}`}><Phone/> Llamar</a><a href={`sms:${order.phone}`}><MessageCircle/> Mensaje</a><a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.address)}`} target="_blank" rel="noreferrer"><Map/> Navegar</a></div><div className="package"><PackageCheck/><div><b>{lineText(order)}</b><small>{order.payment==='Efectivo'&&!order.paid?`Cobrar ${money(order.total)}`:'Pedido pagado · No cobrar'}</small></div><strong>{money(order.total)}</strong></div><button className="primary wide" onClick={next}>{order.status==='Asignado'?'Iniciar entrega':'Confirmar entrega'} <ArrowRight/></button></section></div></main>
}

function Modal({title,close,children,large}) {return <div className="overlay modal-overlay"><div className={`modal ${large?'large':''}`}><div className="panel-head"><h2>{title}</h2><button onClick={close}><X/></button></div>{children}</div></div>}
function Empty({text}){return <div className="empty compact-empty"><ShoppingBag/><h3>{text}</h3></div>}

export default function App(){
  const store=useRestaurantStore()
  const [role,setRoleState]=useState(()=>localStorage.getItem('fuego-active-role')||'cliente'),[cart,setCart]=useState([]),[showCart,setShowCart]=useState(false)
  const setRole=nextRole=>{localStorage.setItem('fuego-active-role',nextRole);setRoleState(nextRole)}
  const cartCount=useMemo(()=>cart.reduce((n,row)=>n+row.qty,0),[cart])
  const addItem=product=>{setCart(rows=>rows.some(r=>r.id===product.id)?rows.map(r=>r.id===product.id?{...r,qty:r.qty+1}:r):[...rows,{...product,qty:1}]);setShowCart(true)}
  const changeQty=(id,delta)=>setCart(rows=>rows.flatMap(row=>row.id!==id?[row]:row.qty+delta>0?[{...row,qty:row.qty+delta}]:[]))
  const createOrder=payload=>{const order=store.createOrder(payload);setCart([]);return order}
  return <div className="app"><Header role={role} setRole={setRole} cartCount={cartCount} onCart={()=>setShowCart(true)}/>{role==='cliente'&&<CustomerView products={store.products} cart={cart} addItem={addItem} changeQty={changeQty} showCart={showCart} setShowCart={setShowCart} createOrder={createOrder}/>} {role==='administrador'&&<AdminView store={store}/>} {role==='produccion'&&<ProductionView store={store}/>} {role==='repartidor'&&<DriverView store={store}/>}</div>
}
