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

wss.on('connection', (ws) => {
  console.log('New client connected');
  
  let clientInfo = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Handle registration
      if (data.type === 'register') {
        clientInfo = {
          accountId: data.accountId,
          role: data.role, // 'master' or 'slave'
          broker: data.broker
        };
        
        if (data.role === 'master') {
          clients.masters.set(data.accountId, ws);
          console.log(`Master registered: ${data.accountId}`);
        } else if (data.role === 'slave') {
          clients.slaves.set(data.accountId, ws);
          console.log(`Slave registered: ${data.accountId}`);
        }
        
        ws.send(JSON.stringify({
          type: 'registered',
          accountId: data.accountId,
          role: data.role
        }));
        return;
      }
      
      // Handle heartbeat
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        return;
      }
      
      // Handle trade signals from master
      if (data.type === 'trade_signal') {
        console.log('Trade signal received:', data);
        
        // Broadcast to all slaves
        let successCount = 0;
        clients.slaves.forEach((slaveWs, slaveId) => {
          if (slaveWs.readyState === WebSocket.OPEN) {
            slaveWs.send(JSON.stringify({
              type: 'execute_trade',
              signal: data.signal,
              masterAccount: clientInfo?.accountId,
              timestamp: Date.now()
            }));
            successCount++;
          }
        });
        
        // Send confirmation back to master
        ws.send(JSON.stringify({
          type: 'signal_broadcasted',
          slavesNotified: successCount,
          timestamp: Date.now()
        }));
      }
      
      // Handle trade execution confirmation from slave
      if (data.type === 'execution_report') {
        console.log('Execution report:', data);
        
        // Forward to master if needed
        if (data.masterAccount && clients.masters.has(data.masterAccount)) {
          const masterWs = clients.masters.get(data.masterAccount);
          if (masterWs.readyState === WebSocket.OPEN) {
            masterWs.send(JSON.stringify({
              type: 'slave_execution',
              slaveAccount: clientInfo?.accountId,
              report: data.report,
              timestamp: Date.now()
            }));
          }
        }
      }
      
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  });

  ws.on('close', () => {
    if (clientInfo) {
      if (clientInfo.role === 'master') {
        clients.masters.delete(clientInfo.accountId);
        console.log(`Master disconnected: ${clientInfo.accountId}`);
      } else if (clientInfo.role === 'slave') {
        clients.slaves.delete(clientInfo.accountId);
        console.log(`Slave disconnected: ${clientInfo.accountId}`);
      }
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});

// Cleanup disconnected clients every 30 seconds
setInterval(() => {
  clients.masters.forEach((ws, id) => {
    if (ws.readyState !== WebSocket.OPEN) {
      clients.masters.delete(id);
    }
  });
  
  clients.slaves.forEach((ws, id) => {
    if (ws.readyState !== WebSocket.OPEN) {
      clients.slaves.delete(id);
    }
  });
}, 30000);
