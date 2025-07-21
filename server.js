import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const groups = new Map();

class Group {
  constructor(id) {
    this.id = id;
    this.members = new Set();
  }
  add(ws) {
    this.members.add(ws);
  }
  remove(ws) {
    this.members.delete(ws);
  }
  broadcast(message, exceptWs = null) {
    for (const member of this.members) {
      if (member !== exceptWs && member.readyState === 1) {
        member.send(JSON.stringify(message));
      }
    }
  }
}

wss.on('connection', (ws) => {
  let userGroup = null;
  let userId = uuidv4();

  ws.on('message', async (data) => {
    let message;
    try {
      message = JSON.parse(data);
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    switch (message.type) {
      case 'create_group': {
        const groupId = uuidv4();
        const group = new Group(groupId);
        groups.set(groupId, group);
        group.add(ws);
        userGroup = group;
        ws.send(JSON.stringify({ type: 'group_created', groupId }));
        break;
      }
      case 'join_group': {
        const groupId = message.groupId;
        if (!groups.has(groupId)) {
          groups.set(groupId, new Group(groupId));
        }
        userGroup = groups.get(groupId);
        userGroup.add(ws);
        ws.send(JSON.stringify({ type: 'joined_group', groupId }));
        break;
      }
      case 'leave_group': {
        if (userGroup) {
          userGroup.remove(ws);
          ws.send(JSON.stringify({ type: 'left_group', groupId: userGroup.id }));
          userGroup = null;
        }
        break;
      }
      case 'chat_message': {
        if (!userGroup) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not in a group' }));
          return;
        }
        userGroup.broadcast({
          type: 'chat_message',
          content: message.content,
          sender: userId,
          timestamp: Date.now()
        }, ws);
        break;
      }
      case 'start_call': {
        if (!userGroup) {
          ws.send(JSON.stringify({ type: 'error', message: 'Not in a group' }));
          return;
        }
        ws.send(JSON.stringify({
          type: 'call_allowed',
          callType: message.callType
        }));
        break;
      }
      case 'encrypted_signaling': {
        if (!userGroup) return;
        userGroup.broadcast({
          type: 'encrypted_signaling',
          data: message.data
        }, ws);
        break;
      }
      default:
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
    }
  });

  ws.on('close', () => {
    if (userGroup) {
      userGroup.remove(ws);
    }
  });
});

app.use(express.static(path.join(__dirname, 'client')));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});