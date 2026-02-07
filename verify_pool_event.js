// Verify the PoolCreated event in the transaction
import { ethers } from 'ethers';

const RPC_URL = 'https://sepolia.base.org';
const TX_HASH = '0x74a92e56f0e9d32f768d729c3a8414cb028f1794b2bc8bc34b472c5724495973';
const POOL_DEPLOYER_ADDRESS = '0xa74c039138D3E726A6Af9A358b92Ee8639692cc1';

async function verifyPoolEvent() {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  
  try {
    const receipt = await provider.getTransactionReceipt(TX_HASH);
    
    if (!receipt) {
      console.log('❌ Transaction receipt not found');
      return;
    }
    
    console.log('Transaction Receipt:');
    console.log('- Block Number:', receipt.blockNumber);
    console.log('- Status:', receipt.status === 1 ? 'Success' : 'Failed');
    console.log('- To:', receipt.to);
    console.log('- Logs Count:', receipt.logs.length);
    
    // PoolCreated event signature
    const poolCreatedTopic = ethers.utils.id('PoolCreated(address,address)');
    console.log('\n🔍 Looking for PoolCreated event...');
    console.log('Expected topic:', poolCreatedTopic);
    
    // Check all logs
    console.log('\n📋 All logs in transaction:');
    receipt.logs.forEach((log, index) => {
      console.log(`\nLog ${index}:`);
      console.log('  Address:', log.address);
      console.log('  Topics:', log.topics);
      
      if (log.topics[0] === poolCreatedTopic) {
        console.log('  ✅ THIS IS THE PoolCreated EVENT!');
        const poolAddress = ethers.utils.getAddress('0x' + log.topics[1].slice(26));
        const creatorAddress = ethers.utils.getAddress('0x' + log.topics[2].slice(26));
        console.log('  Pool Address:', poolAddress);
        console.log('  Creator Address:', creatorAddress);
      }
    });
    
    // Check if the event was emitted from the correct contract
    const poolCreatedLog = receipt.logs.find(
      log => log.address.toLowerCase() === POOL_DEPLOYER_ADDRESS.toLowerCase() 
        && log.topics[0] === poolCreatedTopic
    );
    
    if (poolCreatedLog) {
      console.log('\n✅ PoolCreated event found from correct contract!');
      const poolAddress = ethers.utils.getAddress('0x' + poolCreatedLog.topics[1].slice(26));
      console.log('Pool Address:', poolAddress);
    } else {
      console.log('\n❌ PoolCreated event NOT found from PoolDeployer contract');
      console.log('Expected contract:', POOL_DEPLOYER_ADDRESS);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

verifyPoolEvent();
