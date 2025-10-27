const WebSocket = require('ws');
const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store connected clients with their roles
const clients = {
  masters: new Map(), // accountId -> WebSocket
  slaves: new Map()   // accountId -> WebSocket
};

// Health check endpoint for Render
app.get('/', (req, res) => {
  res.json({ 
    status: 'running',
    masters: clients.masters.size,
    slaves: clients.slaves.size,
    timestamp: new Date().toISOString()
  });
});

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log('=============================================');
  console.log(`[${new Date().toISOString()}] NEW CLIENT CONNECTED`);
  console.log(`IP: ${clientIp}`);
  console.log('=============================================');
  
  let clientInfo = null;

  ws.on('message', (message) => {
    console.log('=============================================');
    console.log(`[${new Date().toISOString()}] MESSAGE RECEIVED`);
    console.log(`Raw length: ${message.length} bytes`);
    console.log(`Raw content: ${message}`);
    
    try {
      const data = JSON.parse(message);
      console.log('Parsed JSON:', JSON.stringify(data, null, 2));
      
      // Handle registration
      if (data.type === 'register') {
        console.log('>>> PROCESSING REGISTRATION');
        console.log(`    Account ID: ${data.accountId}`);
        console.log(`    Broker: ${data.broker}`);
        console.log(`    Symbol: ${data.symbol || 'N/A'}`);
        console.log(`    Role: ${data.role || 'AUTO-DETECTED AS SLAVE'}`);
        
        clientInfo = {
          accountId: data.accountId,
          role: data.role || 'slave', // Default to slave if not specified
          broker: data.broker,
          symbol: data.symbol,
          accountNumber: data.accountNumber
        };
        
        // Store client based on role
        if (clientInfo.role === 'master') {
          clients.masters.set(data.accountId, ws);
          console.log(`✓ Master registered: ${data.accountId}`);
        } else {
          clients.slaves.set(data.accountId, ws);
          console.log(`✓ Slave registered: ${data.accountId}`);
        }
        
        // Send registration confirmation
        const response = {
          type: 'registered',
          accountId: data.accountId,
          role: clientInfo.role,
          timestamp: new Date().toISOString()
        };
        
        ws.send(JSON.stringify(response));
        console.log('>>> SENT REGISTRATION CONFIRMATION:', JSON.stringify(response));
        console.log('=============================================\n');
        return;
      }
      
      // Handle heartbeat/ping
      if (data.type === 'ping') {
        console.log('>>> PROCESSING PING');
        const pong = { 
          type: 'pong', 
          timestamp: new Date().toISOString() 
        };
        ws.send(JSON.stringify(pong));
        console.log('>>> SENT PONG');
        console.log('=============================================\n');
        return;
      }
      
      // Handle status updates
      if (data.type === 'status') {
        console.log('>>> PROCESSING STATUS UPDATE');
        console.log(`    Balance: ${data.balance}`);
        console.log(`    Equity: ${data.equity}`);
        console.log(`    Open Orders: ${data.openOrders}`);
        console.log('=============================================\n');
        return;
      }
      
      // Handle trade notifications
      if (data.type === 'tradeNotification') {
        console.log('>>> PROCESSING TRADE NOTIFICATION');
        console.log(`    Action: ${data.action}`);
        console.log(`    Ticket: ${data.ticket}`);
        console.log(`    Symbol: ${data.symbol}`);
        console.log(`    Type: ${data.orderType}`);
        console.log(`    Lots: ${data.lots}`);
        console.log('=============================================\n');
        return;
      }
      
      // Handle trade signals from master
      // Handle trade signals from master
      if (data.type === 'trade_signal') {
        console.log('>>> PROCESSING TRADE SIGNAL FROM MASTER');
        console.log('Signal:', JSON.stringify(data.signal, null, 2));
      
        // Normalize symbol
        const rawSymbol = data.signal.symbol || "";
        const normalizedSymbol = rawSymbol.replace("/", "").replace("-", "");
      
        // Extract data
        const action = data.signal.action || data.signal.type || "buy";
        const lots = Number(data.signal.lots) || Number(data.signal.volume) || 0.10;
        const ticket = data.signal.ticket || 0; // ✅ preserve master ticket ID
      
        // Build broadcast message (now includes ticket)
        const broadcastMessage = {
          type: 'trade_signal',
          signal: {
            ticket: ticket, // ✅ keep master ticket ID
            action: action,
            symbol: normalizedSymbol,
            lots: lots,
            stopLoss: data.signal.stopLoss || 0,
            takeProfit: data.signal.takeProfit || 0,
            masterAccount: clientInfo?.accountId || "unknown",
            timestamp: new Date().toISOString()
          }
        };
      
        // Send to all slaves
        let successCount = 0;
        clients.slaves.forEach((slaveWs, slaveId) => {
          if (slaveWs.readyState === WebSocket.OPEN) {
            slaveWs.send(JSON.stringify(broadcastMessage));
            console.log(`    → Sent to slave: ${slaveId}`);
            console.log(`      JSON: ${JSON.stringify(broadcastMessage)}`);
            successCount++;
          }
        });
      
        // Confirmation back to master
        const confirmation = {
          type: 'signal_broadcasted',
          slavesNotified: successCount,
          timestamp: new Date().toISOString()
        };
        ws.send(JSON.stringify(confirmation));
      
        console.log(`>>> BROADCAST COMPLETE: ${successCount} slaves notified`);
        console.log('=============================================\n');
        return;
      }


      
      // Handle execution reports from slaves
      if (data.type === 'execution_report') {
        console.log('>>> PROCESSING EXECUTION REPORT FROM SLAVE');
        console.log('Report:', JSON.stringify(data.report, null, 2));
        
        // Forward to master if specified
        if (data.masterAccount && clients.masters.has(data.masterAccount)) {
          const masterWs = clients.masters.get(data.masterAccount);
          if (masterWs.readyState === WebSocket.OPEN) {
            masterWs.send(JSON.stringify({
              type: 'slave_execution',
              slaveAccount: clientInfo?.accountId,
              report: data.report,
              timestamp: new Date().toISOString()
            }));
            console.log(`    → Forwarded to master: ${data.masterAccount}`);
          }
        }
        console.log('=============================================\n');
        return;
      }
      
      // Handle disconnect notifications
      if (data.type === 'disconnect') {
        console.log('>>> PROCESSING DISCONNECT NOTIFICATION');
        console.log(`    Account: ${data.accountId}`);
        console.log('=============================================\n');
        return;
      }
      
      // Unknown message type
      console.log('>>> UNKNOWN MESSAGE TYPE:', data.type);
      console.log('Full data:', JSON.stringify(data, null, 2));
      console.log('=============================================\n');
      
    } catch (error) {
      console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
      console.error('ERROR PROCESSING MESSAGE:', error.message);
      console.error('Stack:', error.stack);
      console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
      
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  });

  ws.on('close', () => {
    console.log('=============================================');
    console.log(`[${new Date().toISOString()}] CLIENT DISCONNECTED`);
    if (clientInfo) {
      if (clientInfo.role === 'master') {
        clients.masters.delete(clientInfo.accountId);
        console.log(`Master removed: ${clientInfo.accountId}`);
      } else if (clientInfo.role === 'slave') {
        clients.slaves.delete(clientInfo.accountId);
        console.log(`Slave removed: ${clientInfo.accountId}`);
      }
    }
    console.log('=============================================\n');
  });

  ws.on('error', (error) => {
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.error(`[${new Date().toISOString()}] WEBSOCKET ERROR`);
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  });

  // Send welcome message immediately
  const welcome = {
    type: 'welcome',
    message: 'Connected to trading server',
    timestamp: new Date().toISOString()
  };
  ws.send(JSON.stringify(welcome));
  console.log('>>> SENT WELCOME MESSAGE');
  console.log('=============================================\n');
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log('=============================================');
  console.log(`WebSocket Server Started`);
  console.log(`Port: ${PORT}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('=============================================\n');
});

// Cleanup disconnected clients every 30 seconds
setInterval(() => {
  let mastersRemoved = 0;
  let slavesRemoved = 0;
  
  clients.masters.forEach((ws, id) => {
    if (ws.readyState !== WebSocket.OPEN) {
      clients.masters.delete(id);
      mastersRemoved++;
    }
  });
  
  clients.slaves.forEach((ws, id) => {
    if (ws.readyState !== WebSocket.OPEN) {
      clients.slaves.delete(id);
      slavesRemoved++;
    }
  });
  
  if (mastersRemoved > 0 || slavesRemoved > 0) {
    console.log(`[${new Date().toISOString()}] Cleanup: Removed ${mastersRemoved} masters, ${slavesRemoved} slaves`);
  }
}, 30000);

// Log connection stats every 60 seconds
setInterval(() => {
  console.log('=============================================');
  console.log(`[${new Date().toISOString()}] CONNECTION STATS`);
  console.log(`Masters: ${clients.masters.size}`);
  console.log(`Slaves: ${clients.slaves.size}`);
  console.log(`Total: ${clients.masters.size + clients.slaves.size}`);
  console.log('=============================================\n');
}, 60000);
