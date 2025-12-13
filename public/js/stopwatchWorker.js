// Stopwatch Worker - handles precise timing for Stopwatch component
// This worker runs in the background and is not affected by browser throttling

let stopwatchInterval = null;
let startTime = null;
let pausedElapsed = 0;

self.onmessage = function(e) {
  const { command, elapsed } = e.data;
  
  switch (command) {
    case 'start':
      if (stopwatchInterval) {
        clearInterval(stopwatchInterval);
      }
      // If resuming, account for previously elapsed time
      pausedElapsed = elapsed || 0;
      startTime = Date.now() - pausedElapsed;
      stopwatchInterval = setInterval(() => {
        const currentElapsed = Date.now() - startTime;
        self.postMessage({ type: 'tick', elapsed: currentElapsed });
      }, 10); // Update every 10ms for smooth display
      break;
      
    case 'stop':
      if (stopwatchInterval) {
        clearInterval(stopwatchInterval);
        stopwatchInterval = null;
        pausedElapsed = Date.now() - startTime;
        self.postMessage({ type: 'stopped', elapsed: pausedElapsed });
      }
      break;
      
    case 'reset':
      if (stopwatchInterval) {
        clearInterval(stopwatchInterval);
        stopwatchInterval = null;
      }
      startTime = null;
      pausedElapsed = 0;
      self.postMessage({ type: 'reset', elapsed: 0 });
      break;
      
    case 'sync':
      // Sync elapsed time (used for state recovery)
      if (startTime !== null) {
        pausedElapsed = elapsed;
        startTime = Date.now() - pausedElapsed;
      }
      break;
  }
};
