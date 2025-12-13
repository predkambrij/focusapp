// Alarm Worker - handles precise time checking for Alarm component
// This worker runs in the background and is not affected by browser throttling

let alarmInterval = null;
let targetTime = null; // Format: "HH:MM"

self.onmessage = function(e) {
  const { command, time } = e.data;
  
  switch (command) {
    case 'set':
      if (alarmInterval) {
        clearInterval(alarmInterval);
      }
      targetTime = time; // Expected format: "HH:MM"
      alarmInterval = setInterval(() => {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5); // "HH:MM" format
        
        // Send current time for display updates
        self.postMessage({ type: 'tick', currentTime });
        
        if (currentTime === targetTime) {
          self.postMessage({ type: 'alarm' });
          clearInterval(alarmInterval);
          alarmInterval = null;
          targetTime = null;
        }
      }, 500); // Check every 500ms
      break;
      
    case 'clear':
      if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
      }
      targetTime = null;
      self.postMessage({ type: 'cleared' });
      break;
  }
};
