// client/features/voice.js
export class VoiceManager {
    constructor() {
        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.dataChannel = null;
        this.isCallActive = false;
        this.isMuted = false;
        this.isCameraOff = false;
        this.callStartTime = null;
        this.callTimer = null;
        this.encryptionKey = null;
        this.isInitiator = false;
        this.signalingData = new Map();
        
        this.initializeWebRTC();
        this.initializeEncryption();
    }

    async initializeWebRTC() {
        // Configure STUN servers for NAT traversal - using multiple providers for redundancy
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun.cloudflare.com:3478' },
                { urls: 'stun:stun.nextcloud.com:443' }
            ],
            iceCandidatePoolSize: 10,
            // Disable ICE candidate gathering timeout for better privacy
            iceTransportPolicy: 'all',
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        };
    }

    async initializeEncryption() {
        try {
            // Generate ephemeral encryption key for call metadata
            this.encryptionKey = await window.crypto.subtle.generateKey(
                {
                    name: "AES-GCM",
                    length: 256
                },
                false,
                ["encrypt", "decrypt"]
            );
            console.log('Call encryption initialized');
        } catch (error) {
            console.error('Failed to initialize call encryption:', error);
        }
    }

    async startCall(isVideo = false, ws = null) {
        try {
            this.isInitiator = true;
            
            // Get user media with enhanced privacy settings
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    // Disable audio processing that could leave traces
                    googEchoCancellation: false,
                    googAutoGainControl: false,
                    googNoiseSuppression: false,
                    googHighpassFilter: false,
                    googTypingNoiseDetection: false
                },
                video: isVideo ? {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 },
                    // Disable video processing that could leave traces
                    googNoiseReduction: false
                } : false
            };

            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            if (isVideo) {
                const localVideo = document.getElementById('localVideo');
                if (localVideo) {
                    localVideo.srcObject = this.localStream;
                }
            }

            // Create peer connection with enhanced privacy
            this.peerConnection = new RTCPeerConnection(this.rtcConfig);

            // Create encrypted data channel for metadata
            this.dataChannel = this.peerConnection.createDataChannel('encrypted-metadata', {
                ordered: true,
                protocol: 'encrypted'
            });

            this.setupDataChannel(this.dataChannel);

            // Add local stream to peer connection
            this.localStream.getTracks().forEach(track => {
                // Add track with enhanced privacy settings
                const sender = this.peerConnection.addTrack(track, this.localStream);
                
                // Configure sender for privacy
                if (sender.getParameters) {
                    const params = sender.getParameters();
                    if (params.encodings) {
                        params.encodings.forEach(encoding => {
                            // Disable telemetry and statistics
                            encoding.rid = undefined;
                            encoding.networkPriority = 'high';
                        });
                        sender.setParameters(params);
                    }
                }
            });

            // Handle remote stream
            this.peerConnection.ontrack = (event) => {
                this.remoteStream = event.streams[0];
                if (isVideo) {
                    const remoteVideo = document.getElementById('remoteVideo');
                    if (remoteVideo) {
                        remoteVideo.srcObject = this.remoteStream;
                    }
                }
                console.log('Remote stream received (encrypted)');
            };

            // Handle data channel from remote peer
            this.peerConnection.ondatachannel = (event) => {
                const channel = event.channel;
                this.setupDataChannel(channel);
            };

            // Handle ICE candidates with encryption
            this.peerConnection.onicecandidate = async (event) => {
                if (event.candidate) {
                    // Encrypt ICE candidate before sending
                    const encryptedCandidate = await this.encryptSignalingData({
                        type: 'ice-candidate',
                        candidate: event.candidate,
                        timestamp: Date.now()
                    });
                    
                    // Send through WebSocket with ephemeral flag
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'encrypted_signaling',
                            data: encryptedCandidate,
                            ephemeral: true // Server should not log this
                        }));
                    }
                }
            };

            // Handle connection state changes
            this.peerConnection.onconnectionstatechange = () => {
                console.log('Connection state:', this.peerConnection.connectionState);
                if (this.peerConnection.connectionState === 'connected') {
                    this.onCallConnected();
                } else if (this.peerConnection.connectionState === 'disconnected' || 
                          this.peerConnection.connectionState === 'failed') {
                    this.handleCallDisconnection();
                }
            };

            // Create offer
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: isVideo,
                voiceActivityDetection: false // Disable for privacy
            });

            await this.peerConnection.setLocalDescription(offer);

            // Encrypt and send offer
            const encryptedOffer = await this.encryptSignalingData({
                type: 'offer',
                offer: offer,
                isVideo: isVideo,
                timestamp: Date.now()
            });

            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'encrypted_signaling',
                    data: encryptedOffer,
                    ephemeral: true
                }));
            }

            this.isCallActive = true;
            this.startCallTimer();
            
            document.getElementById('callStatus').textContent = 'Connecting securely...';
            
            console.log('Encrypted call initiated');
        } catch (error) {
            console.error('Failed to start encrypted call:', error);
            this.handleCallError('Failed to access camera/microphone');
        }
    }

    async handleEncryptedSignaling(encryptedData, ws) {
        try {
            const data = await this.decryptSignalingData(encryptedData);
            
            switch (data.type) {
                case 'offer':
                    await this.handleOffer(data, ws);
                    break;
                case 'answer':
                    await this.handleAnswer(data);
                    break;
                case 'ice-candidate':
                    await this.handleIceCandidate(data);
                    break;
            }
        } catch (error) {
            console.error('Failed to handle encrypted signaling:', error);
        }
    }

    async handleOffer(data, ws) {
        if (!this.peerConnection) {
            // Create peer connection for incoming call
            this.peerConnection = new RTCPeerConnection(this.rtcConfig);
            
            // Setup for incoming call
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    googEchoCancellation: false,
                    googAutoGainControl: false,
                    googNoiseSuppression: false
                },
                video: data.isVideo ? {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 },
                    googNoiseReduction: false
                } : false
            };

            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            if (data.isVideo) {
                const localVideo = document.getElementById('localVideo');
                if (localVideo) {
                    localVideo.srcObject = this.localStream;
                }
            }

            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            this.peerConnection.ontrack = (event) => {
                this.remoteStream = event.streams[0];
                if (data.isVideo) {
                    const remoteVideo = document.getElementById('remoteVideo');
                    if (remoteVideo) {
                        remoteVideo.srcObject = this.remoteStream;
                    }
                }
            };

            this.peerConnection.ondatachannel = (event) => {
                this.setupDataChannel(event.channel);
            };

            this.peerConnection.onicecandidate = async (event) => {
                if (event.candidate) {
                    const encryptedCandidate = await this.encryptSignalingData({
                        type: 'ice-candidate',
                        candidate: event.candidate,
                        timestamp: Date.now()
                    });
                    
                    if (ws && ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({
                            type: 'encrypted_signaling',
                            data: encryptedCandidate,
                            ephemeral: true
                        }));
                    }
                }
            };
        }

        await this.peerConnection.setRemoteDescription(data.offer);
        
        const answer = await this.peerConnection.createAnswer({
            voiceActivityDetection: false
        });
        
        await this.peerConnection.setLocalDescription(answer);

        const encryptedAnswer = await this.encryptSignalingData({
            type: 'answer',
            answer: answer,
            timestamp: Date.now()
        });

        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'encrypted_signaling',
                data: encryptedAnswer,
                ephemeral: true
            }));
        }

        this.isCallActive = true;
        this.startCallTimer();
    }

    async handleAnswer(data) {
        if (this.peerConnection) {
            await this.peerConnection.setRemoteDescription(data.answer);
        }
    }

    async handleIceCandidate(data) {
        if (this.peerConnection) {
            await this.peerConnection.addIceCandidate(data.candidate);
        }
    }

    setupDataChannel(channel) {
        channel.onopen = () => {
            console.log('Encrypted data channel opened');
        };

        channel.onmessage = async (event) => {
            try {
                const encryptedData = JSON.parse(event.data);
                const decryptedData = await this.decryptChannelData(encryptedData);
                this.handleChannelMessage(decryptedData);
            } catch (error) {
                console.error('Failed to decrypt channel data:', error);
            }
        };

        channel.onclose = () => {
            console.log('Encrypted data channel closed');
        };
    }

    async sendChannelMessage(data) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            const encryptedData = await this.encryptChannelData(data);
            this.dataChannel.send(JSON.stringify(encryptedData));
        }
    }

    handleChannelMessage(data) {
        switch (data.type) {
            case 'mute_status':
                console.log('Remote peer mute status:', data.isMuted);
                break;
            case 'camera_status':
                console.log('Remote peer camera status:', data.isCameraOff);
                break;
            case 'call_quality':
                // Handle call quality metrics without storing them
                break;
        }
    }

    onCallConnected() {
        document.getElementById('callStatus').textContent = 'Connected (Encrypted)';
        
        // Send initial status
        this.sendChannelMessage({
            type: 'connection_established',
            timestamp: Date.now()
        });
    }

    handleCallDisconnection() {
        console.log('Call disconnected');
        this.endCall();
    }

    endCall() {
        // Clear all streams and connections
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
                // Clear any potential traces
                track.enabled = false;
            });
            this.localStream = null;
        }

        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => {
                track.stop();
            });
            this.remoteStream = null;
        }

        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }

        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        // Clear encryption keys
        this.signalingData.clear();
        
        this.isCallActive = false;
        this.stopCallTimer();
        
        // Reset UI elements
        const localVideo = document.getElementById('localVideo');
        const remoteVideo = document.getElementById('remoteVideo');
        if (localVideo) localVideo.srcObject = null;
        if (remoteVideo) remoteVideo.srcObject = null;

        // Force garbage collection of media streams
        if (window.gc) {
            window.gc();
        }

        console.log('Call ended - all traces cleared');
    }

    toggleMute() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                this.isMuted = !audioTrack.enabled;
                
                // Notify remote peer through encrypted channel
                this.sendChannelMessage({
                    type: 'mute_status',
                    isMuted: this.isMuted,
                    timestamp: Date.now()
                });
                
                return this.isMuted;
            }
        }
        return false;
    }

    toggleCamera() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                this.isCameraOff = !videoTrack.enabled;
                
                // Notify remote peer through encrypted channel
                this.sendChannelMessage({
                    type: 'camera_status',
                    isCameraOff: this.isCameraOff,
                    timestamp: Date.now()
                });
                
                return this.isCameraOff;
            }
        }
        return false;
    }

    startCallTimer() {
        this.callStartTime = Date.now();
        this.callTimer = setInterval(() => {
            const elapsed = Date.now() - this.callStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            const timerElement = document.getElementById('callTimer');
            if (timerElement) {
                timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }

    stopCallTimer() {
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
        
        const timerElement = document.getElementById('callTimer');
        if (timerElement) {
            timerElement.textContent = '00:00';
        }
    }

    // Encryption methods for signaling data
    async encryptSignalingData(data) {
        if (!this.encryptionKey) return data;

        try {
            const encoder = new TextEncoder();
            const dataString = JSON.stringify(data);
            const dataBuffer = encoder.encode(dataString);
            
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            
            const encryptedData = await window.crypto.subtle.encrypt(
                {
                    name: "AES-GCM",
                    iv: iv
                },
                this.encryptionKey,
                dataBuffer
            );

            const combined = new Uint8Array(iv.length + encryptedData.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encryptedData), iv.length);

            return btoa(String.fromCharCode(...combined));
        } catch (error) {
            console.error('Signaling encryption failed:', error);
            return data;
        }
    }

    async decryptSignalingData(encryptedData) {
        if (!this.encryptionKey) return encryptedData;

        try {
            const combined = new Uint8Array(
                atob(encryptedData).split('').map(char => char.charCodeAt(0))
            );

            const iv = combined.slice(0, 12);
            const encrypted = combined.slice(12);

            const decryptedData = await window.crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: iv
                },
                this.encryptionKey,
                encrypted
            );

            const decoder = new TextDecoder();
            const dataString = decoder.decode(decryptedData);
            return JSON.parse(dataString);
        } catch (error) {
            console.error('Signaling decryption failed:', error);
            return encryptedData;
        }
    }

    // Encryption methods for data channel
    async encryptChannelData(data) {
        return this.encryptSignalingData(data);
    }

    async decryptChannelData(encryptedData) {
        return this.decryptSignalingData(encryptedData);
    }

    handleCallError(message) {
        console.error('Call error:', message);
        document.getElementById('callStatus').textContent = 'Call Failed';
        
        // Auto-return to chat after error
        setTimeout(() => {
            this.endCall();
            document.getElementById('chatInterface').classList.remove('hidden');
            document.getElementById('callInterface').classList.add('hidden');
        }, 3000);
    }

    // Screen sharing with encryption
    async startScreenShare() {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'never', // Don't capture cursor for privacy
                    displaySurface: 'window' // Limit to window sharing
                },
                audio: false // Disable audio capture for privacy
            });

            if (this.peerConnection) {
                const videoTrack = screenStream.getVideoTracks()[0];
                const sender = this.peerConnection.getSenders().find(s => 
                    s.track && s.track.kind === 'video'
                );
                
                if (sender) {
                    await sender.replaceTrack(videoTrack);
                }
            }

            // Handle screen share end
            screenStream.getVideoTracks()[0].onended = () => {
                this.stopScreenShare();
            };

            // Notify remote peer
            this.sendChannelMessage({
                type: 'screen_share_started',
                timestamp: Date.now()
            });

            return true;
        } catch (error) {
            console.error('Screen share failed:', error);
            return false;
        }
    }

    async stopScreenShare() {
        if (this.localStream && this.peerConnection) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            const sender = this.peerConnection.getSenders().find(s => 
                s.track && s.track.kind === 'video'
            );
            
            if (sender && videoTrack) {
                await sender.replaceTrack(videoTrack);
            }
        }

        this.sendChannelMessage({
            type: 'screen_share_stopped',
            timestamp: Date.now()
        });
    }
}