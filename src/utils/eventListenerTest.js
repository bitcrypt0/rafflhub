/**
 * Test utilities for the raffle event listening functionality
 * These functions help verify that event listening is working correctly
 */

/**
 * Test the event listener hook with a mock raffle address
 */
export const testEventListener = (raffleAddress) => {
  console.log('🧪 Testing Event Listener for raffle:', raffleAddress);
  
  // Mock event data for testing
  const mockEvents = [
    {
      eventName: 'WinnersSelected',
      args: [['0x1234567890123456789012345678901234567890', '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd']],
      timestamp: Date.now(),
      blockNumber: 12345678
    },
    {
      eventName: 'PrizeClaimed',
      args: ['0x1234567890123456789012345678901234567890', 1],
      timestamp: Date.now() + 1000,
      blockNumber: 12345679
    },
    {
      eventName: 'TicketsPurchased',
      args: ['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', 3],
      timestamp: Date.now() + 2000,
      blockNumber: 12345680
    }
  ];
  
  return mockEvents;
};

/**
 * Simulate event firing for testing purposes
 */
export const simulateRaffleEvents = (eventHandlers, delay = 1000) => {
  console.log('🎭 Simulating raffle events...');
  
  const events = [
    {
      name: 'TicketsPurchased',
      handler: eventHandlers.onTicketsPurchased,
      args: ['0x1234567890123456789012345678901234567890', 2]
    },
    {
      name: 'WinnersSelected',
      handler: eventHandlers.onWinnersSelected,
      args: [['0x1234567890123456789012345678901234567890']]
    },
    {
      name: 'PrizeClaimed',
      handler: eventHandlers.onPrizeClaimed,
      args: ['0x1234567890123456789012345678901234567890', 1]
    }
  ];
  
  events.forEach((event, index) => {
    setTimeout(() => {
      if (event.handler) {
        console.log(`🎯 Simulating ${event.name} event`);
        event.handler(...event.args, { 
          transactionHash: `0x${'a'.repeat(64)}`,
          blockNumber: 12345678 + index 
        });
      }
    }, delay * (index + 1));
  });
  
  return events.length;
};

/**
 * Validate event listener configuration
 */
export const validateEventListenerConfig = (config) => {
  const requiredFields = ['raffleAddress'];
  const optionalFields = [
    'onWinnersSelected',
    'onStateChange', 
    'onPrizeClaimed',
    'onTicketsPurchased',
    'enablePolling',
    'pollingInterval',
    'autoStart'
  ];
  
  const validation = {
    isValid: true,
    errors: [],
    warnings: []
  };
  
  // Check required fields
  requiredFields.forEach(field => {
    if (!config[field]) {
      validation.isValid = false;
      validation.errors.push(`Missing required field: ${field}`);
    }
  });
  
  // Check optional fields and provide warnings
  if (!config.onWinnersSelected && !config.onStateChange) {
    validation.warnings.push('No event handlers provided - listener will not be very useful');
  }
  
  if (config.pollingInterval && config.pollingInterval < 5000) {
    validation.warnings.push('Polling interval less than 5 seconds may cause performance issues');
  }
  
  if (config.pollingInterval && config.pollingInterval > 60000) {
    validation.warnings.push('Polling interval greater than 60 seconds may miss rapid state changes');
  }
  
  console.log('📋 Event Listener Config Validation:', validation);
  return validation;
};

/**
 * Monitor event listener performance
 */
export const createEventListenerMonitor = () => {
  const monitor = {
    startTime: Date.now(),
    eventCount: 0,
    errorCount: 0,
    lastEventTime: null,
    events: []
  };
  
  const logEvent = (eventName, success = true) => {
    const now = Date.now();
    monitor.lastEventTime = now;
    monitor.eventCount++;
    
    if (!success) {
      monitor.errorCount++;
    }
    
    monitor.events.push({
      name: eventName,
      timestamp: now,
      success
    });
    
    // Keep only last 50 events
    if (monitor.events.length > 50) {
      monitor.events = monitor.events.slice(-50);
    }
  };
  
  const getStats = () => {
    const runtime = Date.now() - monitor.startTime;
    const eventsPerMinute = monitor.eventCount > 0 ? (monitor.eventCount / runtime) * 60000 : 0;
    const errorRate = monitor.eventCount > 0 ? (monitor.errorCount / monitor.eventCount) * 100 : 0;
    
    return {
      runtime: Math.round(runtime / 1000), // seconds
      totalEvents: monitor.eventCount,
      totalErrors: monitor.errorCount,
      eventsPerMinute: Math.round(eventsPerMinute * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      lastEventTime: monitor.lastEventTime,
      recentEvents: monitor.events.slice(-10)
    };
  };
  
  const reset = () => {
    monitor.startTime = Date.now();
    monitor.eventCount = 0;
    monitor.errorCount = 0;
    monitor.lastEventTime = null;
    monitor.events = [];
  };
  
  return {
    logEvent,
    getStats,
    reset
  };
};

/**
 * Test event listener with real contract (if available)
 */
export const testWithRealContract = async (contractInstance, testDuration = 30000) => {
  if (!contractInstance) {
    console.warn('No contract instance provided for real testing');
    return null;
  }
  
  console.log(`🔗 Testing with real contract for ${testDuration / 1000} seconds...`);
  
  const monitor = createEventListenerMonitor();
  const events = [];
  
  // Set up temporary listeners
  const handlers = {
    winnersSelected: (...args) => {
      monitor.logEvent('WinnersSelected');
      events.push({ type: 'WinnersSelected', args, timestamp: Date.now() });
    },
    prizeClaimed: (...args) => {
      monitor.logEvent('PrizeClaimed');
      events.push({ type: 'PrizeClaimed', args, timestamp: Date.now() });
    },
    ticketsPurchased: (...args) => {
      monitor.logEvent('TicketsPurchased');
      events.push({ type: 'TicketsPurchased', args, timestamp: Date.now() });
    }
  };
  
  // Attach listeners
  contractInstance.on('WinnersSelected', handlers.winnersSelected);
  contractInstance.on('PrizeClaimed', handlers.prizeClaimed);
  contractInstance.on('TicketsPurchased', handlers.ticketsPurchased);
  
  // Wait for test duration
  await new Promise(resolve => setTimeout(resolve, testDuration));
  
  // Clean up listeners
  contractInstance.off('WinnersSelected', handlers.winnersSelected);
  contractInstance.off('PrizeClaimed', handlers.prizeClaimed);
  contractInstance.off('TicketsPurchased', handlers.ticketsPurchased);
  
  const stats = monitor.getStats();
  
  console.log('📊 Real Contract Test Results:', {
    ...stats,
    capturedEvents: events
  });
  
  return {
    stats,
    events
  };
};

// Export for console testing
if (typeof window !== 'undefined') {
  window.eventListenerTests = {
    test: testEventListener,
    simulate: simulateRaffleEvents,
    validate: validateEventListenerConfig,
    monitor: createEventListenerMonitor,
    testReal: testWithRealContract
  };
  
  console.log('🧪 Event Listener test utilities loaded! Use window.eventListenerTests for testing.');
}
