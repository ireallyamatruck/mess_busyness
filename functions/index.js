const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// Weighted busyness update function
exports.updateBusyness = functions.https.onRequest(async (req, res) => {
  try {
    const { messId, status } = req.body;

    if (!messId || !status) {
      return res.status(400).json({ error: "Missing messId or status" });
    }

    const weightMap = { empty: 0, moderate: 1, busy: 2 };
    const weight = weightMap[status];
    const now = new Date();

    const timeSlot = `${now.getHours()}_${Math.floor(now.getMinutes() / 15)}`; // 15-min slots

    // Save current vote
    await db.collection("votes").doc(messId).collection("entries").add({
      status,
      weight,
      timestamp: now,
    });

    // Update historical average for that slot
    const histRef = db
      .collection("busyness_history")
      .doc(messId)
      .collection("slots")
      .doc(timeSlot);

    const histSnap = await histRef.get();
    let histAvg = weight;
    let histCount = 1;

    if (histSnap.exists) {
      const data = histSnap.data();
      histAvg = (data.avg * data.count + weight) / (data.count + 1);
      histCount = data.count + 1;
    }

    await histRef.set({ avg: histAvg, count: histCount }, { merge: true });

    // Calculate live average from recent votes (last 15 mins)
    const since = new Date(now.getTime() - 15 * 60 * 1000);
    const votesSnap = await db
      .collection("votes")
      .doc(messId)
      .collection("entries")
      .where("timestamp", ">", since)
      .get();

    const liveWeights = votesSnap.docs.map((d) => d.data().weight);
    const liveAvg = liveWeights.length
      ? liveWeights.reduce((a, b) => a + b, 0) / liveWeights.length
      : histAvg;

    // Blend both (adaptive weighting)
    const ALPHA = 0.6;
    const finalScore = ALPHA * liveAvg + (1 - ALPHA) * histAvg;

    let statusLabel = "moderate";
    if (finalScore < 0.66) statusLabel = "empty";
    else if (finalScore > 1.33) statusLabel = "busy";

    // Update the global status doc
    await db.collection("busyness_status").doc(messId).set(
      {
        currentStatus: statusLabel,
        voteCount: liveWeights.length,
        lastUpdate: now,
      },
      { merge: true }
    );

    // Send JSON response back
    res.json({ status: statusLabel, score: finalScore });
  } catch (error) {
    console.error("Error updating busyness:", error);
    res.status(500).json({ error: error.message });
  }
});
