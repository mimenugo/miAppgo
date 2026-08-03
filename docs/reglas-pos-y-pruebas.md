# Reglas POS, caja y pedidos

## Estados operativos

- **Recibido:** el pedido entró al sistema.
- **Pendiente de pago:** espera confirmación de una pasarela en línea.
- **Confirmado:** pago confirmado sin preparación pendiente.
- **En preparación:** cocina y/o barra trabajan la comanda.
- **Listo para recoger / Listo para enviar:** todas las áreas requeridas terminaron.
- **Asignado a repartidor:** una entrega lista ya tiene repartidor.
- **En ruta, Entregado y Cancelado:** estados finales del flujo logístico.

El estado de pago se conserva por separado. Un pedido a domicilio pagadero en efectivo puede entrar a preparación sin marcarse como pagado.

## Caja

- El ticket visible usa `FG-01`, `FG-02`, etc. y reinicia por fecha oficial del negocio. El folio interno incluye la fecha para seguir siendo único.
- El cierre **X** termina un turno; el cierre **Z** termina la jornada.
- Ningún cierre se permite mientras exista un pedido del día sin cobrar.
- Un pedido web puede recibirse con la caja cerrada; caja muestra una alerta de apertura pendiente.

## Preparación

Cada producto conserva su área: Cocina, Barra o Ambas. Un pedido mixto solo cambia a listo cuando todas sus comandas están terminadas. Pedidos nuevos y pedidos listos generan resaltado visual y una señal audible cuando el navegador lo permite.

## Pagos

- Caja: efectivo, transferencia, QR, CoDi, DiMo o tarjeta en terminal física.
- Web/PWA: Stripe Checkout alojado; la selección no marca el pedido como pagado. El webhook firmado confirma el cobro.
- Las llaves privadas de Stripe existen únicamente en variables del backend.

## Pruebas manuales recomendadas

1. Abrir un turno y registrar fondo inicial.
2. Crear un pedido para recoger con productos de cocina y barra; confirmar que no solicita dirección.
3. Finalizar solo un área y confirmar que el pedido sigue en preparación.
4. Finalizar la segunda área y confirmar `Listo para recoger`.
5. Crear un pedido a domicilio y confirmar que exige teléfono y dirección y aparece en reparto.
6. Dejar un pedido sin cobrar e intentar cierre X/Z; debe bloquearse mostrando los folios.
7. Verificar que efectivo solicita cajón una sola vez y que transferencia/tarjeta no lo abren.
8. Habilitar Stripe en pruebas, completar Checkout y verificar que el webhook cambie el pago a Pagado.
9. Cambiar la zona del dispositivo para comprobar la alerta de reloj.
10. Confirmar el total MXN y el equivalente USD pequeño en el ticket.
