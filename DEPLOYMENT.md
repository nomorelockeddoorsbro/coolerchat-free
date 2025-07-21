# 🚀 SecureChat Deployment Guide

## Production Deployment

### Prerequisites
- Node.js 18+ 
- SSL Certificate (required for WebRTC)
- Domain name
- Stripe account (for payments)

### Environment Setup

1. **Create production environment file:**
```bash
cp .env .env.production
```

2. **Configure production variables:**
```env
NODE_ENV=production
PORT=443
STRIPE_SECRET_KEY=sk_live_your_live_stripe_key
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_publishable_key
```

### SSL/HTTPS Setup

WebRTC requires HTTPS in production. Options:

**Option 1: Reverse Proxy (Recommended)**
```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

**Option 2: Direct HTTPS (Advanced)**
```javascript
// server.js modifications for direct HTTPS
import https from 'https';
import fs from 'fs';

const server = https.createServer({
    key: fs.readFileSync('path/to/private-key.pem'),
    cert: fs.readFileSync('path/to/certificate.pem')
}, app);
```

### Docker Deployment

**Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

USER node

CMD ["npm", "start"]
```

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  securechat:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
    restart: unless-stopped
    
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl
    depends_on:
      - securechat
    restart: unless-stopped
```

### Cloud Platform Deployment

**Heroku:**
```bash
# Install Heroku CLI
npm install -g heroku

# Login and create app
heroku login
heroku create your-securechat-app

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set STRIPE_SECRET_KEY=sk_live_your_key

# Deploy
git push heroku main
```

**Railway:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

**DigitalOcean App Platform:**
```yaml
# .do/app.yaml
name: securechat
services:
- name: web
  source_dir: /
  github:
    repo: your-username/securechat
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
  - key: STRIPE_SECRET_KEY
    value: sk_live_your_key
    type: SECRET
```

### Performance Optimization

**PM2 Process Manager:**
```bash
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'securechat',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
EOF

# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### Monitoring & Logging

**Health Checks:**
```bash
# Check server health
curl https://yourdomain.com/health

# Check API stats
curl https://yourdomain.com/api/stats
```

**Log Management:**
```bash
# PM2 logs
pm2 logs securechat

# Docker logs
docker logs securechat-container

# System logs
journalctl -u securechat
```

### Security Hardening

**Firewall Configuration:**
```bash
# UFW (Ubuntu)
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Fail2ban for SSH protection
apt install fail2ban
```

**Rate Limiting:**
```javascript
// Add to server.js
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);
```

### Backup & Recovery

**Database Backup (if using persistent storage):**
```bash
# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf backup_$DATE.tar.gz /app/data
aws s3 cp backup_$DATE.tar.gz s3://your-backup-bucket/
```

### Scaling Considerations

**Horizontal Scaling:**
- Use Redis for session storage across instances
- Implement sticky sessions for WebSocket connections
- Consider WebRTC TURN servers for NAT traversal

**Load Balancing:**
```nginx
upstream securechat {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}

server {
    location / {
        proxy_pass http://securechat;
    }
}
```

### Maintenance

**Updates:**
```bash
# Zero-downtime deployment
pm2 reload ecosystem.config.js --env production

# Rolling updates with Docker
docker-compose up -d --no-deps web
```

**Monitoring:**
```bash
# Server resources
htop
iotop
netstat -tulpn

# Application metrics
pm2 monit
```

## Security Checklist

- [ ] HTTPS/WSS enabled
- [ ] Stripe keys are production keys
- [ ] Firewall configured
- [ ] Rate limiting enabled
- [ ] Logs are not storing sensitive data
- [ ] Regular security updates
- [ ] SSL certificate auto-renewal
- [ ] Backup strategy implemented

## Troubleshooting

**Common Issues:**

1. **WebRTC not working:**
   - Ensure HTTPS is enabled
   - Check STUN server accessibility
   - Verify firewall allows WebRTC ports

2. **WebSocket connection fails:**
   - Check proxy configuration
   - Verify WebSocket upgrade headers
   - Test with direct connection

3. **Payment processing errors:**
   - Verify Stripe keys are correct
   - Check webhook endpoints
   - Test with Stripe test cards

**Debug Commands:**
```bash
# Check WebSocket connection
wscat -c wss://yourdomain.com/ws

# Test HTTPS
curl -I https://yourdomain.com

# Verify SSL certificate
openssl s_client -connect yourdomain.com:443
```