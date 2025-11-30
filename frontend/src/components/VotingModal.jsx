import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  Button,
  Text,
} from '@chakra-ui/react';

function VotingModal({ isOpen, onClose, onSubmit }) {
  const handleVote = (voteValue) => {
    onSubmit(voteValue);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>How busy is the mess right now?</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack spacing={4}>
            <Text fontSize="sm" color="gray.600" textAlign="center">
              Your vote helps others decide when to visit!
            </Text>
            
            <Button
              w="full"
              size="lg"
              colorScheme="green"
              onClick={() => handleVote('empty')}
            >
              🟢 Empty - Few people
            </Button>

            <Button
              w="full"
              size="lg"
              colorScheme="yellow"
              onClick={() => handleVote('moderate')}
            >
              🟡 Moderate - Normal crowd
            </Button>

            <Button
              w="full"
              size="lg"
              colorScheme="red"
              onClick={() => handleVote('busy')}
            >
              🔴 Busy - Very crowded
            </Button>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export default VotingModal;
