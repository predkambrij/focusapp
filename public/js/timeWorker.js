// Time Worker - handles precise timing for Timer component
// This worker runs in the background and is not affected by browser throttling

let timerInterval = null;
let endTime = null;

self.onmessage = function(e) {
  const { command, duration } = e.data;
  
  switch (command) {
    case 'start':
      if (timerInterval) {
        clearInterval(timerInterval);
      }
      endTime = Date.now() + (duration * 1000);
      timerInterval = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
        self.postMessage({ type: 'tick', remaining });
        if (remaining <= 0) {
          clearInterval(timerInterval);
          timerInterval = null;
          self.postMessage({ type: 'finished' });
        }
      }, 100); // Check every 100ms for accuracy
      break;
      
    case 'pause':
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        // Return remaining time when paused
        const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
        self.postMessage({ type: 'paused', remaining });
      }
      break;
      
    case 'stop':
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      endTime = null;
      self.postMessage({ type: 'stopped' });
      break;
      
    case 'sync':
      // Update the end time (used when resuming with a specific duration)
      endTime = Date.now() + (duration * 1000);
      break;
  }
};
