/**
 * Utility functions for Chrome storage operations
 */

// Get data from storage
async function getFromStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => {
      resolve(result);
    });
  });
}

// Save data to storage
async function saveToStorage(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, () => {
      resolve();
    });
  });
}

// Remove data from storage
async function removeFromStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, () => {
      resolve();
    });
  });
}

// Clear all storage
async function clearStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.clear(() => {
      resolve();
    });
  });
}

// Check for storage changes
function addStorageListener(callback) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      callback(changes);
    }
  });
}

// Get initial data and store it if not already present
async function initializeStorage(defaultData) {
  const existingData = await getFromStorage(Object.keys(defaultData));
  
  const dataToStore = {};
  let needsStore = false;
  
  // Check which default values need to be stored
  for (const [key, value] of Object.entries(defaultData)) {
    if (existingData[key] === undefined) {
      dataToStore[key] = value;
      needsStore = true;
    }
  }
  
  // Store any missing default values
  if (needsStore) {
    await saveToStorage(dataToStore);
  }
  
  // Return the current data (existing + any new defaults)
  return { ...defaultData, ...existingData };
}

// Export all functions
window.storageUtils = {
  get: getFromStorage,
  save: saveToStorage,
  remove: removeFromStorage,
  clear: clearStorage,
  onChanged: addStorageListener,
  initialize: initializeStorage
}; 