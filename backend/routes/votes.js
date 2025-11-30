const express = require('express');
const router = express.Router();
const { updateBusyness } = require('../models/Vote');

// Submit a vote
router.post('/vote', async (req, res) => {
  try {
    const { messId, status, userId } = req.body;

    if (!messId || !status) {
      return res.status(400).json({ 
        error: 'Missing required fields: messId and status' 
      });
    }

    if (!['empty', 'moderate', 'busy'].includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status. Must be: empty, moderate, or busy' 
      });
    }

    const result = await updateBusyness(messId, status, userId);
    
    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('❌ Vote error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to submit vote' 
    });
  }
});

// Get current busyness for a specific mess
router.get('/busyness/:messId', async (req, res) => {
  try {
    const { messId } = req.params;
    const { db } = require('../server');

    const statusDoc = await db.collection('busyness_status')
      .doc(messId)
      .get();

    if (!statusDoc.exists) {
      return res.json({
        messId,
        currentStatus: 'moderate',
        voteCount: 0,
        message: 'No votes yet'
      });
    }

    res.json({
      messId,
      ...statusDoc.data()
    });

  } catch (error) {
    console.error('Error fetching busyness:', error);
    res.status(500).json({ error: 'Failed to fetch busyness data' });
  }
});

module.exports = router;
