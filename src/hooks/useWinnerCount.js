import { useState, useEffect } from 'react';
import { useContract } from '../contexts/ContractContext';

/**
 * Custom hook to fetch winner count for a raffle
 * Used for determining singular/plural badge text
 */
export const useWinnerCount = (raffleAddress, raffleState) => {
  const [winnerCount, setWinnerCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { getContractInstance } = useContract();

  useEffect(() => {
    const fetchWinnerCount = async () => {
      // Only fetch for completed or claimed states
      if (!raffleAddress || (raffleState !== 4 && raffleState !== 7)) {
        setWinnerCount(0);
        return;
      }

      setLoading(true);
      try {
        const raffleContract = getContractInstance(raffleAddress, 'raffle');
        if (!raffleContract) {
          setWinnerCount(0);
          return;
        }

        const winnersCount = await raffleContract.winnersCount();
        const count = winnersCount.toNumber ? winnersCount.toNumber() : Number(winnersCount);
        setWinnerCount(count);
      } catch (error) {
        console.warn('Failed to fetch winner count for', raffleAddress, error);
        setWinnerCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchWinnerCount();
  }, [raffleAddress, raffleState, getContractInstance]);

  return { winnerCount, loading };
};

/**
 * Utility function to get dynamic label for Prizes Claimed state
 */
export const getDynamicPrizeLabel = (stateNum, winnerCount) => {
  if (stateNum === 7) { // Prizes Claimed state
    return winnerCount === 1 ? 'Prize Claimed' : 'Prizes Claimed';
  }
  return null; // Not a prizes claimed state
};
