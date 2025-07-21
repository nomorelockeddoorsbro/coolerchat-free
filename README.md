# SecureChat - Zero-Trace Messaging & Calling

A privacy-first, end-to-end encrypted messaging and calling application with no data retention, no registration required, and complete anonymity.

![SecureChat Interface](https://images.pexels.com/photos/5380664/pexels-photo-5380664.jpeg?auto=compress&cs=tinysrgb&w=800)

## 🔒 **Privacy & Security Features**

### **Zero-Trace Architecture**
- **No Registration**: Completely anonymous - no accounts, emails, or personal data required
- **No Data Storage**: Messages and calls are never stored on servers
- **Ephemeral Messages**: Auto-delete after 24 hours (configurable)
- **Memory Cleanup**: All traces cleared from memory after use

### **End-to-End Encryption**
- **AES-GCM 256-bit**: Military-grade encryption for all messages
- **ECDH Key Exchange**: Secure key generation and exchange
- **WebRTC DTLS/SRTP**: Native encryption for voice/video calls
- **Encrypted Signaling**: Even connection setup data is encrypted

### **Untraceable Calling**
- **Peer-to-Peer**: Direct WebRTC connections bypass servers
- **No Call Records**: Server never logs or stores call data
- **Encrypted Metadata**: Call status and quality data encrypted
- **Multiple STUN Servers**: Redundant anonymity infrastructure

## 🚀 **Features**

### **Messaging**
- ✅ Real-time encrypted messaging
- ✅ Auto-deleting messages (1 hour)
- ✅ Instant message deletion (individual & bulk)
- ✅ Typing indicators
- ✅ Room-based conversations
- ✅ No message history retention

### **Voice & Video Calling**
- ✅ Encrypted voice calls
- ✅ HD video calling
- ✅ Screen sharing (privacy-protected)
- ✅ Mute/camera controls
- ✅ Call timer and status

### **Privacy Controls**
- ✅ Anonymous room creation
- ✅ Shareable room IDs
- ✅ Automatic connection cleanup
- ✅ No telemetry or tracking

## 🛠 **Technology Stack**

### **Frontend**
- **Vanilla JavaScript**: No frameworks for minimal attack surface
- **Web Crypto API**: Browser-native encryption
- **WebRTC**: Peer-to-peer communication
- **Tailwind CSS**: Modern, responsive design

### **Backend**
- **Node.js**: Lightweight server
- **WebSocket**: Real-time communication
- **Express**: Minimal HTTP server
- **TweetNaCl**: Additional cryptographic functions

### **Security Libraries**
- **Web Crypto API**: AES-GCM, ECDH encryption
- **WebRTC**: DTLS/SRTP for media encryption
- **TweetNaCl**: Additional crypto utilities

## 📦 **Installation & Setup**

### **Prerequisites**
- Node.js 18+ 
- Modern browser with WebRTC support
- HTTPS/WSS for production (required for WebRTC)

### **Quick Start**
```bash
# Clone the repository
git clone <repository-url>
cd secure-chat-server

# Install dependencies
npm install
npx vite build --mode production
pm2 start server.js --name my-app-production
# Start the development server
npm run dev
```

### **Production Deployment**
```bash
# Build the application
npm run build

# Start production server
npm start
```

### **Environment Variables**
```env
# Optional: Stripe for premium features
STRIPE_SECRET_KEY=sk_test_your_stripe_key
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key

# Server configuration
PORT=3000
```

## 🎯 **How to Use**

### **Starting a Conversation**
1. **Create Room**: Click "Create New Chat Room"
2. **Share ID**: Room ID is automatically copied to clipboard
3. **Invite Others**: Share the room ID with participants
4. **Start Messaging**: Begin encrypted conversations immediately

### **Joining a Conversation**
1. **Get Room ID**: Obtain room ID from the creator
2. **Enter ID**: Paste room ID in the join field
3. **Click Join**: Connect to the encrypted room
4. **Start Chatting**: All messages are automatically encrypted

### **Making Calls**
1. **Join Room**: Must be in a chat room first
2. **Voice Call**: Click phone icon for audio-only call
3. **Video Call**: Click video icon for video call
4. **Screen Share**: Click desktop icon during active call
5. **End Call**: Click red phone icon to disconnect

## 🔧 **Configuration**

### **Message Limits**
```javascript
// server.js - Adjust free message limit
const FREE_MESSAGE_LIMIT = 10; // Default: 10 messages
const FREE_CALL_LIMIT = 2; // Default: 2 calls

// client/main.js - Adjust auto-delete timer
setTimeout(() => {
    messageElement.remove();
}, 3600000); // Default: 1 hour (3,600,000 milliseconds)
```

### **Call Settings**
```javascript
// client/features/voice.js - Adjust call quality
const constraints = {
    video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
    }
};
```

### **Security Settings**
```javascript
// client/features/crypto.js - Encryption configuration
const keyConfig = {
    name: "AES-GCM",
    length: 256 // 256-bit encryption
};
```

## 🏗 **Architecture**

### **Client-Side Components**
```
client/
├── index.html          # Main application interface
├── main.js             # Application controller
└── features/
    ├── crypto.js       # Encryption management
    ├── voice.js        # WebRTC calling system
    └── canvas.js       # Future: collaborative drawing
```

### **Server-Side Components**
```
server.js               # WebSocket server & HTTP server
├── Group Management    # Room creation and joining
├── Message Relay       # Encrypted message forwarding
├── Signaling Relay     # WebRTC connection setup
└── Payment Processing  # Optional Stripe integration
```

### **Data Flow**
```
Client A → [Encrypt] → WebSocket → Server → WebSocket → [Decrypt] → Client B
                                     ↓
                              No Storage/Logging
```

## 🛡 **Security Considerations**

### **What We Protect Against**
- ✅ **Server Compromise**: No plaintext data stored
- ✅ **Network Interception**: End-to-end encryption
- ✅ **Metadata Analysis**: Encrypted signaling
- ✅ **Call Recording**: Peer-to-peer media streams
- ✅ **Traffic Analysis**: Multiple STUN servers

### **Limitations**
- ⚠️ **Browser Security**: Relies on browser crypto implementation
- ⚠️ **Endpoint Security**: Cannot protect compromised devices
- ⚠️ **Network Analysis**: ISP can see connection patterns
- ⚠️ **WebRTC Leaks**: IP addresses may be exposed to peers

### **Best Practices**
- Use HTTPS/WSS in production
- Deploy behind Tor for maximum anonymity
- Regular security audits of crypto implementation
- Keep dependencies updated

## 💰 **Monetization**

### **Freemium Model**
- **Free Tier**: 10 messages + 2 calls per session
- **Pro Upgrade**: $2.99 for unlimited messaging and calling
- **Payment**: Stripe integration included

### **Customization**
```javascript
// Adjust pricing in server.js
const paymentIntent = await stripe.paymentIntents.create({
    amount: 299, // $2.99 in cents
    currency: 'usd'
});
```

## 🤝 **Contributing**

### **Development Setup**
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run in development mode
# Frontend: http://localhost:5173
# Backend: http://localhost:3000
```

### **Code Structure**
- **Modular Design**: Separate concerns (crypto, voice, UI)
- **No Frameworks**: Vanilla JS for security auditing
- **Clean Architecture**: Clear separation of client/server
- **Security First**: All features designed with privacy in mind

## 📄 **License**

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.

## ⚠️ **Disclaimer**

This software is provided for educational and research purposes. While we implement strong encryption and privacy measures, no system is 100% secure. Users should understand the limitations and use appropriate operational security practices.

## 🆘 **Support**

For security issues, please report privately. For general questions and feature requests, please use the issue tracker.

---

**Built with privacy in mind. No tracking, no data collection, no compromises.**