import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5001';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    if (this.socket?.connected) return this.socket;

    this.socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket.id);
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Subscribe to busyness updates
  onBusynessUpdate(callback) {
    if (!this.socket) this.connect();
    this.socket.on('busynessUpdate', callback);
  }

  // Request current busyness data
  requestBusynessData() {
    if (!this.socket) this.connect();
    this.socket.emit('requestBusynessData');
  }

  // Submit a vote
  submitVote(voteData) {
    if (!this.socket) this.connect();
    return new Promise((resolve, reject) => {
      this.socket.emit('submitVote', voteData);
      
      const timeout = setTimeout(() => {
        reject(new Error('Vote submission timeout'));
      }, 5000);

      this.socket.once('busynessUpdate', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });

      this.socket.once('voteError', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  // Remove listeners
  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

// Singleton instance
const socketService = new SocketService();

export default socketService;
