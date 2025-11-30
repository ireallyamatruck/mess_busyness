import { Box, VStack, Heading, Text, Badge, HStack } from '@chakra-ui/react';
import { motion } from "framer-motion";

function BusynessDisplay({ busynessData, userNearMess }) {
  const getStatusConfig = (status) => {
    const configs = {
      empty: { emoji: '🟢', color: 'green', label: 'Empty' },
      moderate: { emoji: '🟡', color: 'yellow', label: 'Moderate' },
      busy: { emoji: '🔴', color: 'red', label: 'Busy' }
    };
    return configs[status] || configs.moderate;
  };
  
  const config = getStatusConfig(busynessData.status);
  
  const MotionBox = motion(Box);

  const bgColors = {
    empty: 'green.50',
    moderate: 'yellow.50',
    busy: 'red.50'
  };

  const timeAgo = (timestamp) => {
    const diff = Math.floor((Date.now() - new Date(timestamp)) / 60000);
    if (diff < 1) return "just now";
    if (diff === 1) return "1 minute ago";
    return `${diff} minutes ago`;
  };

  return (
    <Box
      bg="white"
      p={8}
      borderRadius="xl"
      boxShadow="lg"
      textAlign="center"
    >
      <VStack spacing={6}>
        <Heading size="lg" color="gray.700">
          Mess Busyness Status
        </Heading>

        <MotionBox
          key={config.status}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <Text fontSize="6xl">{config.emoji}</Text>
          <Badge
            colorScheme={config.color}
            fontSize="2xl"
            px={6}
            py={2}
            borderRadius="full"
          >
            {config.label}
          </Badge>
        </MotionBox>

        <VStack spacing={2}>
          <Text fontSize="sm" color="gray.600">
            Based on {busynessData.voteCount} recent votes
          </Text>
          {busynessData.lastUpdate && (
            <Text fontSize="xs" color="gray.500">
              Updated: {new Date(busynessData.lastUpdate).toLocaleTimeString()}
            </Text>
          )}
        </VStack>

        {userNearMess ? (
          <Text fontSize="sm" color="green.600">
            You're near the mess — cast your vote now!
          </Text>
        ) : (
          <Text fontSize="sm" color="orange.500">
            Get closer to the mess to vote!
          </Text>
        )}
      </VStack>
    </Box>
  );
}

export default BusynessDisplay;
