import React, { useState } from 'react';
import { useContract } from '../contexts/ContractContext';
import { useWallet } from '../contexts/WalletContext';
import { contractABIs } from '../contracts/contractABIs';
import { ethers } from 'ethers';
import { toast } from './ui/sonner';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';

const PRIZE_TYPES = [
  { value: 'erc20', label: 'ERC20' },
  { value: 'erc721', label: 'ERC721' },
  { value: 'erc1155', label: 'ERC1155' },
];

const TokenPreApprovalCard = () => {
  const { contracts } = useContract();
  const { provider, connected, address } = useWallet();
  const [prizeType, setPrizeType] = useState('erc20');
  const [tokenAddress, setTokenAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [loading, setLoading] = useState(false);

  const raffleDeployerAddress = contracts?.raffleDeployer?.address || '';

  const handleApprove = async () => {
    if (!connected || !provider) {
      toast.error('Please connect your wallet');
      return;
    }
    if (!ethers.utils.isAddress(tokenAddress)) {
      toast.error('Please enter a valid token contract address');
      return;
    }
    setLoading(true);
    try {
      const signer = provider.getSigner();
      let contract, tx;
      if (prizeType === 'erc20') {
        if (!amount || isNaN(amount) || Number(amount) <= 0) {
          toast.error('Enter a valid amount');
          setLoading(false);
          return;
        }
        contract = new ethers.Contract(tokenAddress, contractABIs.erc20, signer);
        const decimals = await contract.decimals();
        const parsedAmount = ethers.utils.parseUnits(amount, decimals);
        tx = await contract.approve(raffleDeployerAddress, parsedAmount);
        await tx.wait();
        toast.success('ERC20 approval successful!');
      } else if (prizeType === 'erc721') {
        if (!tokenId || isNaN(tokenId)) {
          toast.error('Enter a valid Token ID');
          setLoading(false);
          return;
        }
        contract = new ethers.Contract(tokenAddress, contractABIs.erc721Prize, signer);
        tx = await contract.approve(raffleDeployerAddress, tokenId);
        await tx.wait();
        toast.success('ERC721 approval successful!');
      } else if (prizeType === 'erc1155') {
        contract = new ethers.Contract(tokenAddress, contractABIs.erc1155Prize, signer);
        tx = await contract.setApprovalForAll(raffleDeployerAddress, true);
        await tx.wait();
        toast.success('ERC1155 approval successful!');
      }
    } catch (e) {
      toast.error('Approval failed: ' + (e?.reason || e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Token Pre-Approval</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">Grant RaffleDeployer approval to escrow prizes before creating a raffle.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-base font-medium mb-2">Prize Type</label>
          <select
            className="w-full px-2 py-1 rounded border bg-white text-black dark:bg-gray-900 dark:text-white text-sm"
            value={prizeType}
            onChange={e => setPrizeType(e.target.value)}
          >
            {PRIZE_TYPES.map(type => (
              <option
                key={type.value}
                value={type.value}
                className="bg-white text-black dark:bg-gray-900 dark:text-white"
              >
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-base font-medium mb-2">Prize Token Contract Address</label>
          <input
            type="text"
            className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background font-mono"
            value={tokenAddress}
            onChange={e => setTokenAddress(e.target.value)}
            placeholder="0x..."
          />
        </div>
        {prizeType === 'erc20' && (
          <div>
            <label className="block text-base font-medium mb-2">Amount</label>
            <input
              type="number"
              min="0"
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Amount to approve"
            />
          </div>
        )}
        {prizeType === 'erc721' && (
          <div>
            <label className="block text-base font-medium mb-2">Token ID</label>
            <input
              type="number"
              min="0"
              className="w-full px-3 py-2.5 text-base border border-border rounded-lg bg-background"
              value={tokenId}
              onChange={e => setTokenId(e.target.value)}
              placeholder="Token ID to approve"
            />
          </div>
        )}
        <Button
          className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-colors disabled:opacity-50"
          onClick={handleApprove}
          disabled={loading || !connected}
        >
          {loading ? 'Approving...' : 'Approve'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default TokenPreApprovalCard; 