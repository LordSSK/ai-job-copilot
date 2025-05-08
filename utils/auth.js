/**
 * Authentication utility for handling user accounts and subscription status
 * This is a simplified version that doesn't implement actual authentication
 * In a real extension, you would integrate with a backend service or auth provider
 */

// User states
const AuthState = {
  LOGGED_OUT: 'logged_out',
  LOGGED_IN: 'logged_in',
  PREMIUM: 'premium'
};

// Default auth data
const defaultAuthData = {
  state: AuthState.LOGGED_OUT,
  user: null,
  subscription: null,
  lastUpdated: null
};

// Check if user is logged in
async function isLoggedIn() {
  const authData = await getAuthData();
  return authData.state !== AuthState.LOGGED_OUT;
}

// Check if user has premium subscription
async function isPremium() {
  const authData = await getAuthData();
  return authData.state === AuthState.PREMIUM;
}

// Get current auth data
async function getAuthData() {
  const data = await storageUtils.get('auth');
  return data.auth || { ...defaultAuthData };
}

// Update auth data
async function updateAuthData(newData) {
  const currentData = await getAuthData();
  const updatedData = {
    ...currentData,
    ...newData,
    lastUpdated: new Date().toISOString()
  };
  
  await storageUtils.save({ auth: updatedData });
  return updatedData;
}

// Mock login function (in a real extension, this would communicate with a server)
async function login(credentials) {
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Mock successful login
  const userData = {
    id: 'user123',
    email: credentials.email,
    name: 'Demo User',
    avatar: null
  };
  
  return updateAuthData({
    state: AuthState.LOGGED_IN,
    user: userData,
    subscription: {
      plan: 'free',
      expiresAt: null
    }
  });
}

// Mock logout function
async function logout() {
  return updateAuthData(defaultAuthData);
}

// Mock upgrade to premium
async function upgradeToPremium() {
  const authData = await getAuthData();
  
  if (authData.state === AuthState.LOGGED_OUT) {
    throw new Error('User must be logged in to upgrade');
  }
  
  // Calculate expiration date (30 days from now)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  
  return updateAuthData({
    state: AuthState.PREMIUM,
    subscription: {
      plan: 'premium',
      expiresAt: expiresAt.toISOString()
    }
  });
}

// Check if subscription has expired
async function checkSubscriptionStatus() {
  const authData = await getAuthData();
  
  if (authData.state !== AuthState.PREMIUM) {
    return;
  }
  
  // Check if subscription has expired
  if (authData.subscription?.expiresAt) {
    const expiresAt = new Date(authData.subscription.expiresAt);
    const now = new Date();
    
    if (now > expiresAt) {
      // Subscription expired, downgrade to regular account
      await updateAuthData({
        state: AuthState.LOGGED_IN,
        subscription: {
          plan: 'free',
          expiresAt: null
        }
      });
    }
  }
}

// Initialize auth on startup
async function initAuth() {
  const authData = await getAuthData();
  
  if (authData.state === AuthState.LOGGED_OUT) {
    // No authentication data, nothing to do
    return;
  }
  
  // Check subscription status
  await checkSubscriptionStatus();
}

// Export all functions
window.authUtils = {
  isLoggedIn,
  isPremium,
  getAuthData,
  login,
  logout,
  upgradeToPremium,
  init: initAuth,
  AuthState
}; 