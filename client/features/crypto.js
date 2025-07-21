// client/features/crypto.js
export class CryptoManager {
    constructor() {
        this.keyPair = null;
        this.sharedKey = null;
        this.initializeKeys();
    }

    async initializeKeys() {
        try {
            // Generate a key pair for this session
            this.keyPair = await window.crypto.subtle.generateKey(
                {
                    name: "ECDH",
                    namedCurve: "P-256"
                },
                false,
                ["deriveKey"]
            );

            // For demo purposes, we'll use a simple symmetric key
            // In a real app, you'd exchange public keys with other users
            this.sharedKey = await window.crypto.subtle.generateKey(
                {
                    name: "AES-GCM",
                    length: 256
                },
                false,
                ["encrypt", "decrypt"]
            );

            console.log('Encryption keys initialized');
        } catch (error) {
            console.error('Failed to initialize encryption keys:', error);
        }
    }

    async encryptMessage(message) {
        if (!this.sharedKey) {
            console.warn('Encryption key not ready, sending unencrypted');
            return message;
        }

        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(message);
            
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            
            const encryptedData = await window.crypto.subtle.encrypt(
                {
                    name: "AES-GCM",
                    iv: iv
                },
                this.sharedKey,
                data
            );

            // Combine IV and encrypted data
            const combined = new Uint8Array(iv.length + encryptedData.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encryptedData), iv.length);

            // Convert to base64 for transmission
            return btoa(String.fromCharCode(...combined));
        } catch (error) {
            console.error('Encryption failed:', error);
            return message; // Fallback to unencrypted
        }
    }

    async decryptMessage(encryptedMessage) {
        if (!this.sharedKey) {
            console.warn('Decryption key not ready, returning as-is');
            return encryptedMessage;
        }

        try {
            // Convert from base64
            const combined = new Uint8Array(
                atob(encryptedMessage).split('').map(char => char.charCodeAt(0))
            );

            // Extract IV and encrypted data
            const iv = combined.slice(0, 12);
            const encryptedData = combined.slice(12);

            const decryptedData = await window.crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: iv
                },
                this.sharedKey,
                encryptedData
            );

            const decoder = new TextDecoder();
            return decoder.decode(decryptedData);
        } catch (error) {
            console.error('Decryption failed:', error);
            return encryptedMessage; // Fallback to showing encrypted text
        }
    }

    // Generate a secure room ID
    generateRoomId() {
        const array = new Uint8Array(16);
        window.crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    // Hash function for additional security
    async hashData(data) {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
}