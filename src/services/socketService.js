const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
//const ChatService = require('./chatService');
const JobService = require('./jobService');
//const NotificationService = require('./notificationService');

let io;

const initialize = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:4200",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      socket.userName = decoded.name;
      
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User ${socket.userName} (${socket.userId}) connected`);

    // Join user-specific room for notifications
    socket.join(`user:${socket.userId}`);

    // Handle chat room joining
    socket.on('join-chat', async (jobId) => {
      try {
        // Verify user has access to this job
        const hasAccess = await ChatService.verifyChatAccess(jobId, socket.userId, socket.userRole);
        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied to this chat' });
          return;
        }

        const roomName = `chat:${jobId}`;
        socket.join(roomName);
        
        // Load and send recent messages
        const recentMessages = await ChatService.getRecentMessages(jobId);
        socket.emit('chat-history', recentMessages);

        // Notify others in the room
        socket.to(roomName).emit('user-joined', {
          userId: socket.userId,
          userName: socket.userName,
          timestamp: new Date()
        });

      } catch (error) {
        console.error('Error joining chat:', error);
        socket.emit('error', { message: 'Failed to join chat' });
      }
    });

    // Handle leaving chat room
    socket.on('leave-chat', (jobId) => {
      const roomName = `chat:${jobId}`;
      socket.leave(roomName);
      
      socket.to(roomName).emit('user-left', {
        userId: socket.userId,
        userName: socket.userName,
        timestamp: new Date()
      });
    });

    // Handle sending messages
    socket.on('send-message', async (data) => {
      try {
        const { jobId, message, type = 'text' } = data;
        
        // Verify access
        const hasAccess = await ChatService.verifyChatAccess(jobId, socket.userId, socket.userRole);
        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        // Save message to database
        const chatMessage = await ChatService.saveMessage({
          jobId,
          senderId: socket.userId,
          senderName: socket.userName,
          message,
          type,
          timestamp: new Date()
        });

        // Broadcast to all users in the chat room
        const roomName = `chat:${jobId}`;
        io.to(roomName).emit('new-message', chatMessage);

        // Send push notifications to other participants
        const otherParticipants = await ChatService.getOtherParticipants(jobId, socket.userId);
        otherParticipants.forEach(participant => {
          NotificationService.sendPushNotification(participant.userId, {
            title: `New message from ${socket.userName}`,
            body: message.length > 50 ? message.substring(0, 50) + '...' : message,
            data: {
              type: 'chat_message',
              jobId,
              senderId: socket.userId,
              senderName: socket.userName
            }
          });
        });

      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicators
    socket.on('typing', (data) => {
      const { jobId, isTyping } = data;
      const roomName = `chat:${jobId}`;
      
      socket.to(roomName).emit('typing', {
        userId: socket.userId,
        userName: socket.userName,
        isTyping,
        timestamp: new Date()
      });
    });

    // Handle driver location updates
    socket.on('update-location', async (data) => {
      try {
        const { jobId, lat, lng } = data;
        
        // Verify driver has access to this job
        const hasAccess = await JobService.verifyDriverJobAccess(jobId, socket.userId);
        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        // Update location in database
        await JobService.updateDriverLocation(jobId, socket.userId, lat, lng);

        // Broadcast to customer and admin
        const roomName = `chat:${jobId}`;
        io.to(roomName).emit('driver-location', {
          jobId,
          driverId: socket.userId,
          location: { lat, lng },
          timestamp: new Date()
        });

      } catch (error) {
        console.error('Error updating location:', error);
        socket.emit('error', { message: 'Failed to update location' });
      }
    });

    // Handle job status updates (for drivers)
    socket.on('job-status-update', async (data) => {
      try {
        const { jobId, status, eta, notes } = data;
        
        // Verify driver access
        const hasAccess = await JobService.verifyDriverJobAccess(jobId, socket.userId);
        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }

        // Update job status
        const updateResult = await JobService.updateJobStatus(jobId, status, {
          driverId: socket.userId,
          eta,
          notes
        });

        // Broadcast to all relevant users
        const roomName = `chat:${jobId}`;
        io.to(roomName).emit('job-update', {
          jobId,
          status,
          driverId: socket.userId,
          driverName: socket.userName,
          eta,
          notes,
          timestamp: new Date()
        });

        // Send notifications
        const customerId = await JobService.getJobCustomerId(jobId);
        NotificationService.sendPushNotification(customerId, {
          title: 'Job Status Update',
          body: `Your job status has been updated to: ${status}`,
          data: {
            type: 'job_update',
            jobId,
            status
          }
        });

      } catch (error) {
        console.error('Error updating job status:', error);
        socket.emit('error', { message: 'Failed to update job status' });
      }
    });

    // Handle bid submissions (for drivers)
    socket.on('place-bid', async (data) => {
      try {
        const { jobId, amount, eta, notes } = data;
        
        // Verify driver can bid on this job
        const canBid = await JobService.canDriverBid(jobId, socket.userId);
        if (!canBid) {
          socket.emit('error', { message: 'Cannot bid on this job' });
          return;
        }

        // Place bid
        const bid = await JobService.placeBid({
          jobId,
          driverId: socket.userId,
          amount,
          eta: new Date(eta),
          notes
        });

        // Notify customer
        const customerId = await JobService.getJobCustomerId(jobId);
        NotificationService.sendPushNotification(customerId, {
          title: 'New Bid Received',
          body: `${socket.userName} bid $${amount} on your job`,
          data: {
            type: 'new_bid',
            jobId,
            bidId: bid.id,
            driverId: socket.userId,
            driverName: socket.userName,
            amount
          }
        });

      } catch (error) {
        console.error('Error placing bid:', error);
        socket.emit('error', { message: 'Failed to place bid' });
      }
    });

    // Handle new job notifications (for drivers)
    socket.on('subscribe-new-jobs', (data) => {
      const { lat, lng, radius = 25 } = data;
      
      // Join location-based room for new job notifications
      const locationKey = `location:${Math.round(lat)}:${Math.round(lng)}:${radius}`;
      socket.join(locationKey);
      
      // Store driver's location preference
      socket.locationPreference = { lat, lng, radius };
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User ${socket.userName} (${socket.userId}) disconnected`);
      
      // Clean up any active typing indicators
      if (socket.currentChatRoom) {
        socket.to(socket.currentChatRoom).emit('typing', {
          userId: socket.userId,
          userName: socket.userName,
          isTyping: false,
          timestamp: new Date()
        });
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  return io;
};

// Utility functions for emitting events
const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

const emitToChat = (jobId, event, data) => {
  if (io) {
    io.to(`chat:${jobId}`).emit(event, data);
  }
};

const emitToLocation = (lat, lng, radius, event, data) => {
  if (io) {
    const locationKey = `location:${Math.round(lat)}:${Math.round(lng)}:${radius}`;
    io.to(locationKey).emit(event, data);
  }
};

const broadcastToAdmins = (event, data) => {
  if (io) {
    io.to('admin').emit(event, data);
  }
};

module.exports = {
  initialize,
  emitToUser,
  emitToChat,
  emitToLocation,
  broadcastToAdmins
};