// server.js
const WebSocket = require('ws');

const wss = new WebSocket.Server({ 
  port: process.env.PORT || 3000,
  path: '/ws'
});

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  ws.on('message', (data) => {
    console.log('Received:', data.toString());
    
    const message = JSON.parse(data);
    
    if (message.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
    } else if (message.type === 'init') {
      ws.send(JSON.stringify({ 
        type: 'welcome', 
        message: 'Connected to server' 
      }));
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

console.log('WebSocket server running on port', process.env.PORT || 3000);
