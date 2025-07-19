import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { useContract } from '../contexts/ContractContext';
import { ethers } from 'ethers';
import { RaffleCard } from './LandingPage';
import { Trophy, Users, Clock, Ticket } from 'lucide-react';
import { PageContainer } from '../components/Layout';

const stateTitleMap = {
  active: { title: 'Active Raffles', icon: Clock },
  pending: { title: 'Pending Raffles', icon: Users },
  drawing: { title: 'Drawing Phase', icon: Trophy },
  completed: { title: 'Completed Raffles', icon: Ticket },
  ended: { title: 'Ended Raffles', icon: Clock },
};

const RafflesByStatePage = () => {
  const { state } = useParams();
  const { connected } = useWallet();
  const { contracts, getContractInstance } = useContract();
  const [raffles, setRaffles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRaffles = async () => {
      if (!connected) {
        setRaffles([]);
        setError('Please connect your wallet to view raffles');
        return;
      }
      if (!contracts.raffleManager) {
        setError('Contracts not initialized. Please try refreshing the page.');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const registeredRaffles = await contracts.raffleManager.getAllRaffles();
        if (!registeredRaffles || registeredRaffles.length === 0) {
          setRaffles([]);
          setError('No raffles found on the blockchain');
          return;
        }
        const rafflePromises = registeredRaffles.map(async (raffleAddress) => {
          try {
            const raffleContract = getContractInstance(raffleAddress, 'raffle');
            if (!raffleContract) return null;
            const [name, creator, startTime, duration, ticketPrice, ticketLimit, winnersCount, maxTicketsPerParticipant, isPrized, prizeCollection, stateNum, erc20PrizeToken, erc20PrizeAmount, ethPrizeAmount, isExternallyPrized] = await Promise.all([
              raffleContract.name(),
              raffleContract.creator(),
              raffleContract.startTime(),
              raffleContract.duration(),
              raffleContract.ticketPrice(),
              raffleContract.ticketLimit(),
              raffleContract.winnersCount(),
              raffleContract.maxTicketsPerParticipant(),
              raffleContract.isPrized(),
              raffleContract.prizeCollection(),
              raffleContract.state(),
              raffleContract.erc20PrizeToken(),
              raffleContract.erc20PrizeAmount(),
              raffleContract.ethPrizeAmount(),
              raffleContract.isExternallyPrized?.()
            ]);
            let ticketsSold = 0;
            try {
              let count = 0;
              while (true) {
                try {
                  await raffleContract.participants(count);
                  count++;
                } catch {
                  break;
                }
              }
              ticketsSold = count;
            } catch {}
            let raffleState;
            if (stateNum === 0) raffleState = 'pending';
            else if (stateNum === 1) raffleState = 'active';
            else if (stateNum === 2) raffleState = 'drawing';
            else if (stateNum === 3 || stateNum === 4) raffleState = 'completed';
            else if (stateNum === 5) raffleState = 'ended';
            else raffleState = 'ended';
            return {
              id: raffleAddress,
              name,
              address: raffleAddress,
              creator,
              startTime: startTime.toNumber(),
              duration: duration.toNumber(),
              ticketPrice,
              ticketLimit: ticketLimit.toNumber(),
              ticketsSold,
              winnersCount: winnersCount.toNumber(),
              maxTicketsPerParticipant: maxTicketsPerParticipant.toNumber(),
              isPrized,
              prizeCollection, // always set actual value
              stateNum,
              state: raffleState,
              erc20PrizeToken,
              erc20PrizeAmount,
              ethPrizeAmount,
              isExternallyPrized: !!isExternallyPrized
            };
          } catch {
            return null;
          }
        });
        const raffleData = await Promise.all(rafflePromises);
        const validRaffles = raffleData.filter(r => r !== null);
        
        // Apply duration-based logic for categorization
        const now = Math.floor(Date.now() / 1000);
        const isDurationElapsed = (raffle) => {
          return (raffle.startTime + raffle.duration) <= now;
        };

        // Filter raffles based on requested state and duration
        let filteredRaffles = validRaffles;
        if (state === 'ended') {
          // Show raffles whose duration has elapsed but are not completed
          filteredRaffles = validRaffles.filter(raffle => 
            isDurationElapsed(raffle) && 
            raffle.stateNum !== 3 && 
            raffle.stateNum !== 4
          );
        } else if (state === 'active') {
          // Show active raffles whose duration hasn't elapsed
          filteredRaffles = validRaffles.filter(raffle => 
            raffle.stateNum === 1 && !isDurationElapsed(raffle)
          );
        } else if (state === 'pending') {
          // Show pending raffles whose duration hasn't elapsed
          filteredRaffles = validRaffles.filter(raffle => 
            raffle.stateNum === 0 && !isDurationElapsed(raffle)
          );
        } else if (state === 'drawing') {
          // Show drawing raffles whose duration hasn't elapsed
          filteredRaffles = validRaffles.filter(raffle => 
            raffle.stateNum === 2 && !isDurationElapsed(raffle)
          );
        } else if (state === 'completed') {
          // Show completed raffles (state 3 or 4)
          filteredRaffles = validRaffles.filter(raffle => 
            raffle.stateNum === 3 || raffle.stateNum === 4
          );
        }
        
        setRaffles(filteredRaffles.reverse());
        if (filteredRaffles.length === 0) setError(`No ${stateTitleMap[state]?.title?.toLowerCase() || state} raffles found.`);
      } catch (e) {
        setError('Failed to fetch raffles');
        setRaffles([]);
      } finally {
        setLoading(false);
      }
    };
    fetchRaffles();
  }, [connected, contracts, getContractInstance, state]);

  const { title, icon: Icon } = stateTitleMap[state] || { title: 'Raffles', icon: Trophy };

  if (!connected) {
    return (
      <PageContainer className="py-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-4">{title}</h1>
          <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            Please connect your wallet to view raffles.
          </p>
        </div>
      </PageContainer>
    );
  }
  if (loading) {
    return (
      <PageContainer className="py-8">
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg text-gray-500 dark:text-gray-400">Loading {title.toLowerCase()} from blockchain...</p>
        </div>
      </PageContainer>
    );
  }
  if (error) {
    return (
      <PageContainer className="py-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-4">{title}</h1>
          <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
            {error}
          </p>
        </div>
      </PageContainer>
    );
  }
  return (
    <PageContainer className="py-8">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-4">{title}</h1>
        <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
          {state === 'pending' 
            ? 'Be Prepared! These raffles will be Active soon!' 
            : `All ${title.toLowerCase()} on the platform`}
        </p>
      </div>
      <div className="mt-16">
        {raffles.length === 0 ? (
          <div className="text-center py-16">
            <Icon className="h-16 w-16 text-gray-500 dark:text-gray-400 mx-auto mb-4" />
            <h3 className="text-2xl font-semibold mb-2">No {title}</h3>
            <p className="text-gray-500 dark:text-gray-400">There are currently no {title.toLowerCase()}. Check back later!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 min-w-0">
            {raffles.map(raffle => (
              <RaffleCard key={raffle.id} raffle={raffle} />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default RafflesByStatePage; 