const admin = require('firebase-admin');
const db = admin.firestore();

/**
 * Get dynamic weights based on current time
 * Adapts to meal periods automatically
 */
function getDynamicWeights() {
  const now = new Date();
  const hour = now.getHours();
  const timeInMinutes = hour * 60 + now.getMinutes();

  const mealPeriods = [
    {
      name: 'breakfast',
      start: 420,   // 7:00 AM
      end: 570,     // 9:30 AM
      weights: { empty: 0, moderate: 1, busy: 2.5 },
      alpha: 0.7    // Higher weight on live data during meal times
    },
    {
      name: 'lunch',
      start: 720,   // 12:00 PM
      end: 870,     // 2:30 PM
      weights: { empty: 0, moderate: 1, busy: 3 },
      alpha: 0.75
    },
    {
      name: 'dinner',
      start: 1140,  // 7:00 PM
      end: 1290,    // 9:30 PM
      weights: { empty: 0, moderate: 1, busy: 2.8 },
      alpha: 0.7
    }
  ];

  for (const period of mealPeriods) {
    if (timeInMinutes >= period.start && timeInMinutes <= period.end) {
      return period;
    }
  }

  // Off-peak default
  return {
    name: 'off-peak',
    weights: { empty: 0, moderate: 1, busy: 1.5 },
    alpha: 0.5  // Lower weight on live data during off-peak
  };
}

/**
 * Updates mess busyness with adaptive time-based scoring
 */
async function updateBusyness(messId, status, userId = 'anonymous') {
  if (!messId || !status) {
    throw new Error('Missing messId or status');
  }

  const periodConfig = getDynamicWeights();
  const { weights, alpha } = periodConfig;
  const weight = weights[status];
  const now = new Date();

  // Create 15-minute time slots for historical tracking
  const timeSlot = `${now.getHours()}_${Math.floor(now.getMinutes() / 15)}`;

  console.log(`
    🕐 Current Period: ${periodConfig.name}
    ⚖️ Using Weights: ${JSON.stringify(weights)}
    📊 Alpha (live vs historical): ${alpha}
  `);

  // 1. Save the current vote
  await db.collection('votes').doc(messId).collection('entries').add({
    status,
    weight,
    timestamp: now,
    userId,
    mealPeriod: periodConfig.name
  });

  // 2. Update historical average for this time slot
  const histRef = db
    .collection('busyness_history')
    .doc(messId)
    .collection('slots')
    .doc(timeSlot);

  const histSnap = await histRef.get();
  let histAvg = weight;
  let histCount = 1;

  if (histSnap.exists) {
    const data = histSnap.data();
    histAvg = (data.avg * data.count + weight) / (data.count + 1);
    histCount = data.count + 1;
  }

  await histRef.set({ 
    avg: histAvg, 
    count: histCount,
    lastUpdate: now,
    mealPeriod: periodConfig.name
  }, { merge: true });

  // 3. Calculate live average from recent votes (last 5 minutes)
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const votesSnap = await db
    .collection('votes')
    .doc(messId)
    .collection('entries')
    .where('timestamp', '>', fiveMinutesAgo)
    .get();

  const liveWeights = votesSnap.docs.map(d => d.data().weight);
  const liveAvg = liveWeights.length
    ? liveWeights.reduce((a, b) => a + b, 0) / liveWeights.length
    : histAvg;

  // 4. Blend live and historical data (adaptive alpha based on meal period)
  const finalScore = alpha * liveAvg + (1 - alpha) * histAvg;

  // 5. Determine status based on period-specific thresholds
  let statusLabel = 'moderate';
  
  // Dynamic thresholds based on meal period
  const thresholds = {
    breakfast: { empty: 0.5, busy: 1.8 },
    lunch: { empty: 0.4, busy: 2.2 },
    dinner: { empty: 0.5, busy: 2.0 },
    'off-peak': { empty: 0.8, busy: 1.3 }
  };

  const threshold = thresholds[periodConfig.name] || thresholds['off-peak'];

  if (finalScore < threshold.empty) {
    statusLabel = 'empty';
  } else if (finalScore > threshold.busy) {
    statusLabel = 'busy';
  }

  // 6. Update global status
  await db.collection('busyness_status').doc(messId).set({
    currentStatus: statusLabel,
    voteCount: liveWeights.length,
    lastUpdate: now,
    mealPeriod: periodConfig.name,
    finalScore: parseFloat(finalScore.toFixed(2))
  }, { merge: true });

  console.log(`
    ✅ Vote processed for ${messId}
    📊 Live Avg: ${liveAvg.toFixed(2)}, Hist Avg: ${histAvg.toFixed(2)}
    🎯 Final Score: ${finalScore.toFixed(2)}
    📍 Status: ${statusLabel}
  `);

  return { 
    status: statusLabel, 
    score: finalScore,
    mealPeriod: periodConfig.name,
    voteCount: liveWeights.length
  };
}

module.exports = { updateBusyness, getDynamicWeights };
