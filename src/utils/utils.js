// src/utils/utils.js
import axios from 'axios';
import { ethers } from 'ethers';
import HttpsProxyAgent from 'https-proxy-agent';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { API_CONFIG, DEBUG } from '../config/constants.js';

/**
 * Sets up axios with proxy support
 * @param {Object} config - Axios configuration object
 * @param {string|null} proxyUrl - Optional proxy URL (e.g., "http://username:password@ip:port")
 * @returns {axios.AxiosInstance} - Configured axios instance
 */
export function setupAxiosWithProxy(config, proxyUrl = null) {
    // Add timeout to config
    config.timeout = API_CONFIG.TIMEOUT;
    
    // Setup proxy if provided
    if (proxyUrl) {
        try {
            if (DEBUG.VERBOSE) {
                console.log(chalk.blue(`Setting up proxy: ${proxyUrl}`));
            }
            // Add proxy agent to the config
            config.httpsAgent = new HttpsProxyAgent(proxyUrl);
            config.proxy = false; // Necessary to use the custom agent
        } catch (error) {
            if (DEBUG.LOG_ERRORS) {
                console.error(chalk.red(`Error setting up proxy: ${error.message}`));
                console.log(chalk.yellow(`Continuing without proxy...`));
            }
        }
    }
    
    const instance = axios.create(config);
    
    // Only add interceptors if debug is enabled
    if (DEBUG.VERBOSE || DEBUG.LOG_API_RESPONSES) {
        // Add request interceptor for debugging
        instance.interceptors.request.use(request => {
            if (DEBUG.VERBOSE) {
                console.log(chalk.blue(`Request to: ${request.baseURL}${request.url}`));
            }
            return request;
        }, error => {
            if (DEBUG.LOG_ERRORS) {
                console.error(chalk.red(`Request error: ${error.message}`));
            }
            return Promise.reject(error);
        });
        
        // Add response interceptor for debugging
        instance.interceptors.response.use(response => {
            if (DEBUG.VERBOSE) {
                console.log(chalk.green(`Response from: ${response.config.url}, status: ${response.status}`));
            }
            return response;
        }, error => {
            if (DEBUG.LOG_ERRORS) {
                if (error.response) {
                    console.error(chalk.red(`Response error: ${error.message}, status: ${error.response.status}`));
                } else if (error.request) {
                    console.error(chalk.red(`Request made but no response received: ${error.message}`));
                } else {
                    console.error(chalk.red(`Error setting up request: ${error.message}`));
                }
            }
            return Promise.reject(error);
        });
    }
    
    return instance;
}

/**
 * Derives wallet address from private key
 * @param {string} privateKey - Ethereum private key
 * @returns {string} - Derived wallet address
 */
export function getWalletFromPrivateKey(privateKey) {
    try {
        // Ensure privateKey has 0x prefix
        const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
        const wallet = new ethers.Wallet(formattedKey);
        return wallet.address;
    } catch (error) {
        if (DEBUG.LOG_ERRORS) {
            console.error(chalk.red('Error deriving wallet from private key:', error.message));
        }
        return null;
    }
}

/**
 * Sleep utility
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Loads content from a file
 * @param {string} filePath - Path to file
 * @returns {Promise<string>} - File content
 */
export async function loadFileContent(filePath) {
    try {
        return await readFile(filePath, 'utf8');
    } catch (error) {
        if (DEBUG.LOG_ERRORS) {
            console.error(chalk.red(`Error loading file ${filePath}:`, error.message));
        }
        return '';
    }
}

/**
 * Gets the root directory path
 * @returns {string} - Root directory path
 */
export function getRootDir() {
    // Get the directory of the current module
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    // Go up two levels: from /src/utils to /
    return path.resolve(__dirname, '..', '..');
}

/**
 * Creates a promise that resolves after a timeout
 * @param {number} ms - Timeout in milliseconds 
 * @returns {Promise<void>}
 */
export function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a promise that resolves with the result of the promise or rejects after a timeout
 * @param {Promise} promise - The promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @param {string} errorMessage - Error message if timeout occurs
 * @returns {Promise} - Promise with timeout
 */
export function promiseWithTimeout(promise, ms, errorMessage = 'Operation timed out') {
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(errorMessage)), ms);
    });
    return Promise.race([promise, timeoutPromise]);
}