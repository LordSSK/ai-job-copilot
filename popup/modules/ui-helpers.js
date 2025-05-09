/**
 * UI helper functions for the popup
 */

// Update status message
function updateStatus(message, type = 'info') {
  const statusMessage = document.getElementById('status-message');
  statusMessage.textContent = message;
  
  // Apply color based on message type
  statusMessage.style.color = type === 'error' 
    ? 'var(--error-color)' 
    : type === 'warning' 
      ? 'var(--warning-color)' 
      : type === 'success' 
        ? 'var(--success-color)' 
        : '';
}

// Show/hide progress bar
function showProgress(show) {
  const progressBar = document.getElementById('progress-bar');
  progressBar.hidden = !show;
}

// Utility function for debouncing
function debounce(func, delay) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}

export {
  updateStatus,
  showProgress,
  debounce
}; 