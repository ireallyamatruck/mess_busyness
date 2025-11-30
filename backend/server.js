require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');

// Check if Firebase is configured
const useFirebase = process.env.FIREBASE_PROJECT_ID && 
                    process.env.FIREBASE_PRIVATE_KEY && 
                    process.env.FIREBASE_CLIENT_EMAIL;

let db = null;

if (useFirebase) {
  const admin = require('firebase-admin');
  
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
    
    db = admin.firestore();
    console.log('✅ Firebase initialized successfully');
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    console.log('⚠️  Running without Firebase (in-memory mode)');
  }
} else {
  console.log('⚠️  No Firebase credentials found in .env');
  console.log('⚠️  Running in development mode (in-memory storage)');
}

// Rest of your code...


const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Import routes
const votesRouter = require('./routes/votes');
app.use('/api', votesRouter);

// ============================================
// DYNAMIC TIME-BASED WEIGHTING SYSTEM
// ============================================

/**
 * Get current meal period and corresponding weights
 * This adjusts thresholds based on expected mess busyness
 */
function getMealPeriodWeights() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeInMinutes = hour * 60 + minute;

  // Define meal periods with different weight configurations
  const periods = [
    {
      name: 'breakfast',
      start: 7 * 60,      // 7:00 AM
      end: 9 * 60 + 30,   // 9:30 AM
      weights: {
        empty: 0,
        moderate: 1,
        busy: 2.5         // Higher weight for busy during breakfast rush
      },
      thresholds: {
        empty: 0.5,       // Lower threshold = easier to be "empty"
        busy: 1.8         // Higher threshold = harder to be "busy"
      }
    },
    {
      name: 'lunch',
      start: 12 * 60,     // 12:00 PM
      end: 14 * 60 + 30,  // 2:30 PM
      weights: {
        empty: 0,
        moderate: 1,
        busy: 3           // Much higher weight - lunch is typically busiest
      },
      thresholds: {
        empty: 0.4,       // Even harder to be empty during lunch
        busy: 2.2         // Expect more "busy" votes
      }
    },
    {
      name: 'snacks',
      start: 16 * 60,     // 4:00 PM
      end: 18 * 60,       // 6:00 PM
      weights: {
        empty: 0,
        moderate: 1.2,
        busy: 2
      },
      thresholds: {
        empty: 0.7,
        busy: 1.5
      }
    },
    {
      name: 'dinner',
      start: 19 * 60,     // 7:00 PM
      end: 21 * 60 + 30,  // 9:30 PM
      weights: {
        empty: 0,
        moderate: 1,
        busy: 2.8         // High weight for dinner rush
      },
      thresholds: {
        empty: 0.5,
        busy: 2.0
      }
    }
  ];

  // Find current meal period
  for (const period of periods) {
    if (timeInMinutes >= period.start && timeInMinutes <= period.end) {
      return period;
    }
  }

  // Off-peak hours (default weights)
  return {
    name: 'off-peak',
    weights: {
      empty: 0,
      moderate: 1,
      busy: 1.5
    },
    thresholds: {
      empty: 0.8,       // Easier to be empty during off-peak
      busy: 1.3
    }
  };
}

/**
 * Calculate busyness with adaptive time-based weighting
 */
async function calculateAdaptiveBusyness() {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  
  try {
    // Get recent votes from Firestore
    const votesSnapshot = await db.collection('votes')
      .where('timestamp', '>', new Date(fiveMinutesAgo))
      .get();

    if (votesSnapshot.empty) {
      return { 
        status: 'moderate', 
        voteCount: 0, 
        mealPeriod: getMealPeriodWeights().name 
      };
    }

    const recentVotes = [];
    votesSnapshot.forEach(doc => {
      recentVotes.push(doc.data());
    });

    // Get current meal period configuration
    const periodConfig = getMealPeriodWeights();
    const { weights, thresholds } = periodConfig;

    // Count votes by type
    const voteCounts = {
      empty: recentVotes.filter(v => v.vote === 'empty').length,
      moderate: recentVotes.filter(v => v.vote === 'moderate').length,
      busy: recentVotes.filter(v => v.vote === 'busy').length
    };

    // Calculate weighted score using period-specific weights
    const totalVotes = recentVotes.length;
    const busynessScore = 
      (voteCounts.empty * weights.empty) + 
      (voteCounts.moderate * weights.moderate) + 
      (voteCounts.busy * weights.busy);
    
    const avgScore = busynessScore / totalVotes;

    // Apply period-specific thresholds
    let status = 'moderate';
    if (avgScore < thresholds.empty) {
      status = 'empty';
    } else if (avgScore > thresholds.busy) {
      status = 'busy';
    }

    console.log(`
      🕐 Meal Period: ${periodConfig.name}
      📊 Votes: Empty=${voteCounts.empty}, Moderate=${voteCounts.moderate}, Busy=${voteCounts.busy}
      ⚖️ Weighted Score: ${avgScore.toFixed(2)}
      📍 Thresholds: Empty<${thresholds.empty}, Busy>${thresholds.busy}
      ✅ Final Status: ${status}
    `);

    return { 
      status, 
      voteCount: totalVotes,
      mealPeriod: periodConfig.name,
      score: avgScore.toFixed(2)
    };

  } catch (error) {
    console.error('Error calculating busyness:', error);
    return { 
      status: 'moderate', 
      voteCount: 0, 
      mealPeriod: 'unknown' 
    };
  }
}

// ============================================
// SOCKET.IO HANDLING
// ============================================

io.on('connection', (socket) => {
  console.log('✅ New client connected:', socket.id);

  // Send current busyness data on connection
  socket.on('requestBusynessData', async () => {
    const busynessData = await calculateAdaptiveBusyness();
    busynessData.lastUpdate = Date.now();
    socket.emit('busynessUpdate', busynessData);
  });

  // Handle vote submission
  socket.on('submitVote', async (data) => {
    try {
      // Save vote to Firestore
      await db.collection('votes').add({
        vote: data.vote,
        timestamp: new Date(data.timestamp),
        socketId: socket.id,
        mealPeriod: getMealPeriodWeights().name
      });

      console.log(`📝 Vote received: ${data.vote} during ${getMealPeriodWeights().name}`);

      // Recalculate busyness with new vote
      const newBusyness = await calculateAdaptiveBusyness();
      newBusyness.lastUpdate = Date.now();

      // Broadcast updated busyness to all clients
      io.emit('busynessUpdate', newBusyness);
      
    } catch (error) {
      console.error('❌ Error handling vote:', error);
      socket.emit('voteError', { message: 'Failed to submit vote' });
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

// ============================================
// REST API ENDPOINTS
// ============================================

app.get('/api/busyness', async (req, res) => {
  try {
    const busynessData = await calculateAdaptiveBusyness();
    busynessData.lastUpdate = Date.now();
    res.json(busynessData);
  } catch (error) {
    console.error('Error fetching busyness:', error);
    res.status(500).json({ error: 'Failed to fetch busyness data' });
  }
});

// Get meal period info
app.get('/api/meal-period', (req, res) => {
  const periodInfo = getMealPeriodWeights();
  res.json(periodInfo);
});

// ============================================
// CLEANUP TASKS
// ============================================

// Clean up old votes every 30 minutes
setInterval(async () => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const oldVotesSnapshot = await db.collection('votes')
      .where('timestamp', '<', oneHourAgo)
      .get();

    const batch = db.batch();
    oldVotesSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`🧹 Cleaned up ${oldVotesSnapshot.size} old votes`);
  } catch (error) {
    console.error('Error cleaning up votes:', error);
  }
}, 30 * 60 * 1000);

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`
    🚀 Server running on port ${PORT}
    🔥 Firebase connected
    ⏰ Dynamic weighting active
  `);
});

module.exports = { db, getMealPeriodWeights };
