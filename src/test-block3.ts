import { JoseJwtService } from "./modules/auth/infrastructure/services/JoseJwtService.ts";

async function runRealTimeTests() {
  console.log("🧪 Iniciando pruebas automatizadas del Bloque 3: Comunicación en Tiempo Real (End-to-End)...");

  try {
    const jwtService = new JoseJwtService();
    const token = await jwtService.generateToken({
      sub: "1",
      username: "admin",
      fullName: "Administrador Test",
      roles: ["ADMIN"],
      permissions: ["orders:create", "orders:update_status", "orders:cancel"],
    });

    const authHeaders = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    };

    // 1. Conectar cliente WebSocket de prueba al servidor
    console.log("\n--- TEST 1: Conexión WebSocket al servidor en ws://localhost:8000/ws ---");
    const wsUrl = "ws://localhost:8000/ws";
    const ws = new WebSocket(wsUrl);

    const receivedEvents: Array<{ event: string; data: any }> = [];

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout esperando conexión WebSocket en " + wsUrl));
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        console.log("✅ Conexión WebSocket establecida con éxito");
        resolve();
      };

      ws.onerror = (err) => {
        clearTimeout(timeout);
        reject(err);
      };

      ws.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          receivedEvents.push(parsed);
          console.log(`📩 [WS Test Client] Evento recibido: '${parsed.event}'`);
        } catch { /* ignore */ }
      };
    });

    // Esperar mensaje inicial de bienvenida
    await new Promise((r) => setTimeout(r, 600));
    const welcomeEvent = receivedEvents.find((e) => e.event === "CONNECTED");
    if (!welcomeEvent) {
      throw new Error("No se recibió evento CONNECTED de bienvenida");
    }
    console.log("✅ OK: Evento CONNECTED recibido");

    // 2. Test Heartbeat Ping/Pong
    console.log("\n--- TEST 2: Heartbeat Ping / Pong ---");
    ws.send(JSON.stringify({ event: "PING" }));
    await new Promise((r) => setTimeout(r, 300));
    const pongEvent = receivedEvents.find((e) => e.event === "PONG");
    if (!pongEvent) {
      throw new Error("No se recibió PONG en respuesta a ping");
    }
    console.log("✅ OK: PONG recibido en respuesta a ping");

    // 3. Crear pedido vía API HTTP y verificar emisión de ORDER_CREATED al WebSocket
    console.log("\n--- TEST 3: Crear pedido vía POST /api/v1/orders y recibir ORDER_CREATED ---");
    const createRes = await fetch("http://localhost:8000/api/v1/orders", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        userId: 1,
        orderType: "RECOGER",
        items: [
          {
            productId: 1,
            quantity: 1,
            menuType: "UNIVERSITARIO",
            notes: "Para llevar urgente",
          },
        ],
        notes: "Pedido test WebSocket",
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Error HTTP al crear orden: ${createRes.status} ${errText}`);
    }

    const createJson = await createRes.json();
    const createdOrderId = createJson.data.id;
    console.log(`✅ Orden creada vía API HTTP con ID: ${createdOrderId}`);

    // Esperar evento en el WebSocket
    await new Promise((r) => setTimeout(r, 800));
    const createdEvent = receivedEvents.find(
      (e) => e.event === "ORDER_CREATED" && e.data?.orderId === createdOrderId
    );

    if (!createdEvent) {
      throw new Error("No se recibió evento ORDER_CREATED por WebSocket");
    }
    console.log(`✅ OK: ORDER_CREATED recibido por WebSocket para orden #${createdEvent.data.orderNumber} (ID: ${createdEvent.data.orderId})`);
    console.log(`   - Tipo: ${createdEvent.data.orderType}`);
    console.log(`   - Ítems: ${createdEvent.data.items?.length}`);

    // 4. Cambiar estado a CONFIRMADO vía PATCH /api/v1/orders/:id/status y verificar ORDER_STATUS_CHANGED
    console.log("\n--- TEST 4: Cambiar estado vía PATCH /api/v1/orders/:id/status y recibir ORDER_STATUS_CHANGED ---");
    const statusRes = await fetch(`http://localhost:8000/api/v1/orders/${createdOrderId}/status`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({
        newStatus: "CONFIRMADO",
        changedBy: 1,
        notes: "Pago recibido, enviado a cocina",
      }),
    });

    if (!statusRes.ok) {
      const errText = await statusRes.text();
      throw new Error(`Error HTTP al actualizar estado: ${statusRes.status} ${errText}`);
    }

    await new Promise((r) => setTimeout(r, 800));
    const statusChangedEvent = receivedEvents.find(
      (e) =>
        e.event === "ORDER_STATUS_CHANGED" &&
        e.data?.orderId === createdOrderId &&
        e.data?.newStatus === "CONFIRMADO"
    );

    if (!statusChangedEvent) {
      throw new Error("No se recibió evento ORDER_STATUS_CHANGED por WebSocket");
    }
    console.log(`✅ OK: ORDER_STATUS_CHANGED recibido: PENDIENTE → CONFIRMADO`);
    console.log(`   - kitchenStartedAt: ${statusChangedEvent.data.kitchenStartedAt}`);

    // 5. Cancelar pedido vía PATCH /api/v1/orders/:id/cancel y verificar ORDER_CANCELLED
    console.log("\n--- TEST 5: Cancelar pedido vía PATCH /api/v1/orders/:id/cancel y recibir ORDER_CANCELLED ---");
    const cancelRes = await fetch(`http://localhost:8000/api/v1/orders/${createdOrderId}/cancel`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({
        cancelledBy: 1,
        reason: "Cliente canceló pedido de prueba",
      }),
    });

    if (!cancelRes.ok) {
      const errText = await cancelRes.text();
      throw new Error(`Error HTTP al cancelar orden: ${cancelRes.status} ${errText}`);
    }

    await new Promise((r) => setTimeout(r, 800));
    const cancelledEvent = receivedEvents.find(
      (e) => e.event === "ORDER_CANCELLED" && e.data?.orderId === createdOrderId
    );

    if (!cancelledEvent) {
      throw new Error("No se recibió evento ORDER_CANCELLED por WebSocket");
    }
    console.log(`✅ OK: ORDER_CANCELLED recibido para orden #${cancelledEvent.data.orderNumber} (Motivo: "${cancelledEvent.data.reason}")`);

    // Cerrar WebSocket limpiamente
    ws.close();
    await new Promise((r) => setTimeout(r, 200));

    console.log("\n🎉 TODAS LAS PRUEBAS DEL BLOQUE 3 (TIEMPO REAL / WEBSOCKETS) PASARON CON ÉXITO.\n");
  } catch (err) {
    console.error("❌ Error en pruebas de Bloque 3:", err);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  runRealTimeTests();
}
