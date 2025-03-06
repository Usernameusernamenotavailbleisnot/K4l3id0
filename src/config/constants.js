// src/config/constants.js

/**
 * API configuration constants
 */
export const API_CONFIG = {
    BASE_URL: 'https://kaleidofinance.xyz/api/testnet',
    HEADERS: {
        'Content-Type': 'application/json',
        'Referer': 'https://kaleidofinance.xyz/testnet',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
        'Accept': 'application/json',         // Add Accept header
        'Origin': 'https://kaleidofinance.xyz' // Add Origin header
    },
    TIMEOUT: 10000 // 10 seconds timeout for requests
};

/**
 * Mining configuration constants
 */
export const MINING_CONFIG = {
    UPDATE_INTERVAL: 30000, // 30 seconds
    DEFAULT_HASHRATE: 75.5,
    DEFAULT_EFFICIENCY: 1.4,
    DEFAULT_POWER_USAGE: 120,
    EARNINGS_RATE: 0.0001,
    RETRY_ATTEMPTS: 5,       // More retry attempts
    RETRY_DELAY: 3000        // 3 seconds between retries
};

/**
 * File paths
 */
export const FILE_PATHS = {
    PRIVATE_KEYS: 'pk.txt',
    PROXIES: 'proxies.txt'
};

/**
 * Debug settings
 */
export const DEBUG = {
    VERBOSE: false, // Set to true to enable detailed logging
    LOG_API_RESPONSES: false,
    LOG_ERRORS: false
};