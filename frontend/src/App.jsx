import { ChakraProvider, Box, Container } from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import BusynessDisplay from './components/BusynessDisplay';
import VotingModal from './components/VotingModal';
import LocationTracker from './components/LocationTracker';

const SOCKET_URL = 'https://cooper-dozen-trademarks-port.trycloudflare.com';
const socket = io(SOCKET_URL);

function App() {
  const [busynessData, setBusynessData] = useState({
    status: 'moderate',
    voteCount: 0,
    lastUpdate: null
  });
  const [showVotingModal, setShowVotingModal] = useState(false);
  const [userNearMess, setUserNearMess] = useState(false);
  const [hasVotedRecently, setHasVotedRecently] = useState(false);

  useEffect(() => {
    // Listen for real-time busyness updates
    socket.on('busynessUpdate', (data) => {
      setBusynessData(data);
    });

    // Request initial data
    socket.emit('requestBusynessData');

    return () => {
      socket.off('busynessUpdate');
    };
  }, []);

  // Check if user has voted in last 30 minutes
  useEffect(() => {
    const lastVoteTime = localStorage.getItem('lastVoteTime');
    if (lastVoteTime) {
      const timeDiff = Date.now() - parseInt(lastVoteTime);
      setHasVotedRecently(timeDiff < 30 * 60 * 1000); // 30 minutes
    }
  }, []);

  const handleLocationChange = (isNear) => {
    setUserNearMess(isNear);
    // Show voting modal only if near mess and hasn't voted recently
    if (isNear && !hasVotedRecently) {
      setShowVotingModal(true);
    }
  };

  const handleVoteSubmit = async (voteValue) => {
    try {
      socket.emit('submitVote', { 
        vote: voteValue,
        timestamp: Date.now()
      });
      
      // Store vote timestamp
      localStorage.setItem('lastVoteTime', Date.now().toString());
      setHasVotedRecently(true);
      setShowVotingModal(false);
    } catch (error) {
      console.error('Error submitting vote:', error);
    }
  };

  return (
    <ChakraProvider>
      <Box minH="100vh" bg="gray.50">
        <Container maxW="container.md" py={8}>
          <LocationTracker onLocationChange={handleLocationChange} />
          
          <BusynessDisplay 
            busynessData={busynessData}
            userNearMess={userNearMess}
          />

          <VotingModal
            isOpen={showVotingModal}
            onClose={() => setShowVotingModal(false)}
            onSubmit={handleVoteSubmit}
          />
        </Container>
      </Box>
    </ChakraProvider>
  );
}

export default App;
