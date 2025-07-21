import { CryptoManager } from './features/crypto.js';
import { VoiceManager } from './features/voice.js';

class SecureChatApp {
    constructor() {
        this.wss = null;
        this.currentGroupId = null;
        this.cryptoManager = new CryptoManager();
        this.voiceManager = new VoiceManager();
        this.isTyping = false;
        this.typingTimeout = null;

        this.initializeElements();
        this.bindEvents();
        this.connectWebSocket();
    }

    initializeElements() {
        // Screens
        this.welcomeScreen = document.getElementById('welcomeScreen');
        this.chatInterface = document.getElementById('chatInterface');
        this.callInterface = document.getElementById('callInterface');

        // Welcome screen elements
        this.createGroupBtn = document.getElementById('createGroupBtn');
        this.joinGroupBtn = document.getElementById('joinGroupBtn');
        this.groupIdInput = document.getElementById('groupIdInput');

        // Chat interface elements
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.currentGroupIdSpan = document.getElementById('currentGroupId');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.typingIndicator = document.getElementById('typingIndicator');

        // Control buttons
        this.leaveGroupBtn = document.getElementById('leaveGroupBtn');
        this.voiceCallBtn = document.getElementById('voiceCallBtn');
        this.videoCallBtn = document.getElementById('videoCallBtn');
        this.screenShareBtn = document.getElementById('screenShareBtn');

        // Call interface elements
        this.callStatus = document.getElementById('callStatus');
        this.callTimer = document.getElementById('callTimer');
        this.muteBtn = document.getElementById('muteBtn');
        this.endCallBtn = document.getElementById('endCallBtn');
        this.cameraBtn = document.getElementById('cameraBtn');
    }

    bindEvents() {
        // Welcome screen events
        this.createGroupBtn.addEventListener('click', () => this.createGroup());
        this.joinGroupBtn.addEventListener('click', () => this.joinGroup());
        this.groupIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinGroup();
        });

        // Chat events
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
            else this.handleTyping();
        });
        this.leaveGroupBtn.addEventListener('click', () => this.leaveGroup());

        // Call events
        this.voiceCallBtn.addEventListener('click', () => this.startVoiceCall());
        this.videoCallBtn.addEventListener('click', () => this.startVideoCall());
        this.screenShareBtn.addEventListener('click', () => this.toggleScreenShare());
        this.endCallBtn.addEventListener('click', () => this.endCall());
        this.muteBtn.addEventListener('click', () => this.toggleMute());
        this.cameraBtn.addEventListener('click', () => this.toggleCamera());

        // Delete all messages button
        const deleteAllBtn = document.getElementById('deleteAllBtn');
        if (deleteAllBtn) {
            deleteAllBtn.addEventListener('click', () => this.deleteAllMessages());
        }

        // Make this instance globally accessible for delete buttons
        window.chatApp = this;
    }

    connectWebSocket() {
        this.updateConnectionStatus('connecting');
        this.wss = new WebSocket(`wss://${window.location.host}/wss`);

        this.wss.onopen = () => {
            console.log('WebSocket connected');
            this.updateConnectionStatus('connected');
        };

        this.wss.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleWebSocketMessage(message);
        };

        this.wss.onclose = () => {
            console.log('WebSocket disconnected');
            this.updateConnectionStatus('disconnected');
            setTimeout(() => this.connectWebSocket(), 3000);
        };

        this.wss.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus('disconnected');
        };
    }

    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'group_created':
                this.currentGroupId = message.groupId;
                this.showChatInterface();
                this.copyGroupIdToClipboard();
                break;

            case 'joined_group':
                this.currentGroupId = message.groupId;
                this.showChatInterface();
                break;

            case 'chat_message':
                this.displayMessage(message);
                break;

            case 'call_allowed':
                this.voiceManager.startCall(message.callType === 'video', this.ws);
                break;

            case 'encrypted_signaling':
                this.voiceManager.handleEncryptedSignaling(message.data, this.wss);
                break;

            case 'error':
                this.showError(message.message);
                break;

            default:
                console.log('Unknown message type:', message.type);
        }
    }

    createGroup() {
        if (this.wss && this.wss.readyState === WebSocket.OPEN) {
            this.wss.send(JSON.stringify({ type: 'create_group' }));
        } else {
            this.showError('Not connected to server');
        }
    }

    joinGroup() {
        const groupId = this.groupIdInput.value.trim();
        if (!groupId) {
            this.showError('Please enter a room ID');
            return;
        }

        if (this.wss && this.wss.readyState === WebSocket.OPEN) {
            this.wss.send(JSON.stringify({ 
                type: 'join_group', 
                groupId: groupId 
            }));
        } else {
            this.showError('Not connected to server');
        }
    }

    async sendMessage() {
        const messageText = this.messageInput.value.trim();
        if (!messageText) return;

        // Encrypt the message
        const encryptedMessage = await this.cryptoManager.encryptMessage(messageText);
        
        if (this.wss && this.wss.readyState === WebSocket.OPEN) {
            this.wss.send(JSON.stringify({
                type: 'chat_message',
                content: encryptedMessage
            }));

            // Do NOT display your own message here; wait for server echo
            this.messageInput.value = '';
        }
    }

    async displayMessage(message) {
        try {
            // Decrypt the message
            const decryptedContent = await this.cryptoManager.decryptMessage(message.content);

            // Determine if this message is from the current user
            const isOwnMessage = message.sender === this.getOwnUserId();

            const messageElement = document.createElement('div');
            if (isOwnMessage) {
                messageElement.className = 'message-bubble bg-blue-600 rounded-lg p-3 max-w-xs ml-auto relative group';
            } else {
                messageElement.className = 'message-bubble bg-white bg-opacity-20 rounded-lg p-3 max-w-xs mr-auto relative group';
            }

            const timestamp = new Date(message.timestamp).toLocaleTimeString();
            const messageId = 'msg-' + message.timestamp + '-' + message.sender;
            messageElement.id = messageId;

            messageElement.innerHTML = `
                <div class="text-white text-sm">${this.escapeHtml(decryptedContent)}</div>
                <div class="text-blue-200 text-xs mt-1">${timestamp}${isOwnMessage ? ' • You' : ''}</div>
                <button onclick="window.chatApp.deleteMessage('${messageId}')"
                        class="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
                        title="Delete message">
                    <i class="fas fa-times"></i>
                </button>
            `;

            this.messagesContainer.appendChild(messageElement);
            this.scrollToBottom();

            // Auto-delete message after 1 hour
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.remove();
                }
            }, 3600000);

        } catch (error) {
            console.error('Failed to decrypt message:', error);
        }
    }

    // Helper to get this user's ID (if available)
    getOwnUserId() {
        // You may want to set this.userId when joining/creating a group
        // For now, try to get from localStorage or similar if you store it
        return window.localStorage.getItem('securechat_userid') || '';
    }

    handleTyping() {
        if (!this.isTyping) {
            this.isTyping = true;
        }

        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            this.isTyping = false;
        }, 1000);
    }

    startVoiceCall() {
        if (this.wss && this.wss.readyState === WebSocket.OPEN) {
            this.wss.send(JSON.stringify({
                type: 'start_call',
                callType: 'voice'
            }));
        }
        this.showCallInterface(false);
    }

    startVideoCall() {
        if (this.wss && this.wss.readyState === WebSocket.OPEN) {
            this.wss.send(JSON.stringify({
                type: 'start_call',
                callType: 'video'
            }));
        }
        this.showCallInterface(true);
    }

    endCall() {
        this.voiceManager.endCall();
        this.showChatInterface();
    }

    toggleMute() {
        const isMuted = this.voiceManager.toggleMute();
        this.muteBtn.innerHTML = isMuted ? '<i class="fas fa-microphone-slash"></i>' : '<i class="fas fa-microphone"></i>';
    }

    toggleCamera() {
        const isCameraOff = this.voiceManager.toggleCamera();
        this.cameraBtn.innerHTML = isCameraOff ? '<i class="fas fa-video-slash"></i>' : '<i class="fas fa-video"></i>';
    }

    toggleScreenShare() {
        if (this.voiceManager.isCallActive) {
            this.voiceManager.startScreenShare();
        } else {
            this.showError('Start a call first to share your screen');
        }
    }

    showChatInterface() {
        this.welcomeScreen.classList.add('hidden');
        this.chatInterface.classList.remove('hidden');
        this.callInterface.classList.add('hidden');
        this.currentGroupIdSpan.textContent = this.currentGroupId;
        this.messageInput.focus();
    }

    showCallInterface(isVideo) {
        this.chatInterface.classList.add('hidden');
        this.callInterface.classList.remove('hidden');

        if (isVideo) {
            document.getElementById('videoContainer').classList.remove('hidden');
            this.cameraBtn.classList.remove('hidden');
        } else {
            document.getElementById('videoContainer').classList.add('hidden');
            this.cameraBtn.classList.add('hidden');
        }
    }

    leaveGroup() {
        this.currentGroupId = null;
        this.welcomeScreen.classList.remove('hidden');
        this.chatInterface.classList.add('hidden');
        this.messagesContainer.innerHTML = '';
        this.groupIdInput.value = '';
    }

    updateConnectionStatus(status) {
        this.connectionStatus.className = `connection-status ${status}`;
    }

    copyGroupIdToClipboard() {
        navigator.clipboard.writeText(this.currentGroupId).then(() => {
            this.showSuccess('Room ID copied to clipboard! Share it with others to invite them.');
        });
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        alert('Error: ' + message);
    }

    showSuccess(message) {
        alert('Success: ' + message);
    }

    deleteMessage(messageId) {
        const messageElement = document.getElementById(messageId);
        if (messageElement) {
            messageElement.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.remove();
                }
            }, 300);
        }
    }

    deleteAllMessages() {
        if (confirm('Are you sure you want to delete all messages? This action cannot be undone.')) {
            const messages = this.messagesContainer.querySelectorAll('.message-bubble');
            messages.forEach((message, index) => {
                setTimeout(() => {
                    if (message.parentNode) {
                        message.style.animation = 'fadeOut 0.3s ease-out';
                        setTimeout(() => {
                            if (message.parentNode) {
                                message.remove();
                            }
                        }, 300);
                    }
                }, index * 50);
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SecureChatApp();
});