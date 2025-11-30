import { useEffect, useState, useRef } from 'react'; // ✅ Add useRef import
import { Box, Text, Badge, VStack, HStack, Progress, useToast, Button } from '@chakra-ui/react';

const MESS_COORDINATES = {
  latitude: 28.5473754,  
  longitude: 77.1861130,
  radius: 10
};

const DEV_MODE = false;

const MOCK_LOCATION = {
  nearMess: { latitude: 28.5450, longitude: 77.1920 },
  farFromMess: { latitude: 28.5451, longitude: 77.1921 },
  veryFar: { latitude: 28.5460, longitude: 77.1930 }
};

function LocationTracker({ onLocationChange }) {
  // these are called react state declarations (variables) = usestate(initial state)
  const [location, setLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [isNearMess, setIsNearMess] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  
  // ✅ Declare useRef at TOP LEVEL (not inside useEffect!)
  const hasShownInitialToast = useRef(false);

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;   // pi -> 180, ? -> lat1?
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const formatDistance = (meters) => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(2)}km`;
  };

  const requestLocation = () => {
    setLoading(true);
    
    if (DEV_MODE) {
      setTimeout(() => {
        const mockLoc = MOCK_LOCATION.nearMess;
        setPermissionGranted(true);
        setPermissionDenied(false);
        setLoading(false);
        setLocation(mockLoc);
        
        const dist = calculateDistance(
          mockLoc.latitude,
          mockLoc.longitude,
          MESS_COORDINATES.latitude,
          MESS_COORDINATES.longitude
        );
        
        setDistance(dist);
        const nearMess = dist <= MESS_COORDINATES.radius;
        setIsNearMess(nearMess);
        onLocationChange(nearMess);
      }, 500);
      return;
    }

    if (!navigator.geolocation) {
      toast({
        title: 'Geolocation not supported',
        description: 'Your browser does not support location services.',
        status: 'error',
        duration: 5000,
      });
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPermissionGranted(true);
        setPermissionDenied(false);
        setLoading(false);
        
        const { latitude, longitude } = position.coords;
        setLocation({ latitude, longitude });

        const dist = calculateDistance(
          latitude,
          longitude,
          MESS_COORDINATES.latitude,
          MESS_COORDINATES.longitude
        );
        
        setDistance(dist);
        const nearMess = dist <= MESS_COORDINATES.radius;
        setIsNearMess(nearMess);
        onLocationChange(nearMess);
        
        // ✅ Show toast only once on initial load
        if (!hasShownInitialToast.current) {
          if (nearMess) {
            toast({
              id: 'initial-location-success',
              title: '✅ You\'re at the mess!',
              description: `Distance: ${formatDistance(dist)}. You can vote now!`,
              status: 'success',
              duration: 3000,
            });
          } else {
            toast({
              id: 'initial-location-info',
              title: '📍 Location updated',
              description: `You are ${formatDistance(dist)} from the mess.`,
              status: 'info',
              duration: 3000,
            });
          }
          hasShownInitialToast.current = true;
        }
      },
      (error) => {
        setLoading(false);
        setPermissionDenied(true);
        setPermissionGranted(false);

        let errorMessage = 'Unable to get your location.';
        // ... switch/case code ...
        if (!toast.isActive('location-access-denied')) {
          toast({
            id: 'location-access-denied',
            title: 'Location Access Denied',
            description: errorMessage,
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  useEffect(() => {
    requestLocation();
    
    // Watch position continuously
    const watchId = navigator.geolocation?.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ latitude, longitude });

        const dist = calculateDistance(
          latitude,
          longitude,
          MESS_COORDINATES.latitude,
          MESS_COORDINATES.longitude
        );

        setDistance(dist);
        const nearMess = dist <= MESS_COORDINATES.radius;
        
        // ✅ Only show toast when status changes (with unique IDs to prevent duplicates)
        if (nearMess !== isNearMess) {
          setIsNearMess(nearMess);
          onLocationChange(nearMess);
          
          if (nearMess && !toast.isActive('entered-mess')) {
            toast({
              id: 'entered-mess',
              title: '✅ You entered the mess area!',
              description: 'You can now vote on busyness.',
              status: 'success',
              duration: 3000,
            });
          } else if (!nearMess && !toast.isActive('left-mess')) {
            toast({
              id: 'left-mess',
              title: '🚶 You left the mess area',
              description: `Distance: ${formatDistance(dist)}`,
              status: 'warning',
              duration: 3000,
            });
          }
        }
      },
      (error) => console.error('Location watch error:', error),
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isNearMess, onLocationChange]); // ✅ Removed 'toast' from dependencies

  const getDistanceColor = () => {
    if (!distance) return 'gray';
    if (distance <= 5) return 'green';
    if (distance <= 50) return 'yellow';
    if (distance <= 200) return 'orange';
    return 'red';
  };

  if (loading) {
    return (
      <Box mb={4} p={4} bg="white" borderRadius="md" boxShadow="sm">
        <VStack spacing={2}>
          <Text fontSize="sm" color="gray.600">Getting your location...</Text>
          <Progress size="xs" isIndeterminate colorScheme="blue" w="full" />
        </VStack>
      </Box>
    );
  }

  if (permissionDenied) {
    return (
      <Box mb={4} p={4} bg="red.50" borderRadius="md" boxShadow="sm" borderWidth="1px" borderColor="red.200">
        <VStack spacing={3} align="stretch">
          <HStack>
            <Text fontSize="sm" fontWeight="bold" color="red.700">
              ⚠️ Location Access Denied
            </Text>
          </HStack>
          
          <Text fontSize="xs" color="red.600">
            To vote, you need to enable location access:
          </Text>
          
          <VStack align="stretch" spacing={1} fontSize="xs" color="red.600" pl={3}>
            <Text>1. Click the 🔒 lock icon in address bar</Text>
            <Text>2. Set Location to "Allow"</Text>
            <Text>3. On Mac: System Settings → Privacy → Location Services → Enable Chrome</Text>
          </VStack>
          
          <Button size="sm" colorScheme="red" onClick={requestLocation}>
            Try Again
          </Button>
        </VStack>
      </Box>
    );
  }

  return (
    <Box mb={4} p={4} bg="white" borderRadius="md" boxShadow="sm" borderWidth="1px" borderColor="gray.200">
      <VStack spacing={3} align="stretch">
        <HStack justify="space-between">
          <Text fontSize="sm" fontWeight="semibold" color="gray.700">
            📍 Your Location Status
          </Text>
          <Badge colorScheme={isNearMess ? 'green' : 'gray'} fontSize="xs">
            {isNearMess ? 'Inside Mess Area' : 'Outside Mess'}
          </Badge>
        </HStack>

        {distance !== null && (
          <>
            <HStack spacing={2}>
              <Text fontSize="xs" color="gray.600">Distance from mess:</Text>
              <Badge colorScheme={getDistanceColor()} fontSize="md" px={2}>
                {formatDistance(distance)}
              </Badge>
            </HStack>

            {!isNearMess && (
              <Box p={3} bg="orange.50" borderRadius="md" borderWidth="1px" borderColor="orange.200">
                <Text fontSize="sm" color="orange.700" fontWeight="medium">
                  🚶 Go within {MESS_COORDINATES.radius}m of the mess to vote
                </Text>
                <Text fontSize="xs" color="orange.600" mt={1}>
                  You are {formatDistance(distance)} away
                </Text>
              </Box>
            )}

            {isNearMess && (
              <Box p={3} bg="green.50" borderRadius="md" borderWidth="1px" borderColor="green.200">
                <Text fontSize="sm" color="green.700" fontWeight="medium">
                  ✅ You're close enough to vote!
                </Text>
              </Box>
            )}
          </>
        )}

        {location && (
          <Text fontSize="xs" color="gray.400">
            Lat: {location.latitude.toFixed(6)}, Lon: {location.longitude.toFixed(6)}
          </Text>
        )}
      </VStack>
    </Box>
  );
}

export default LocationTracker;
