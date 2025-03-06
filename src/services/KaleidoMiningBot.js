// src/services/KaleidoMiningBot.js
import chalk from 'chalk';
import * as fs from 'fs/promises';
import path from 'path';
import { setupAxiosWithProxy, getRootDir } from '../utils/utils.js';
import { API_CONFIG, MINING_CONFIG, DEBUG } from '../config/constants.js';

export class KaleidoMiningBot {
    constructor(wallet, botIndex, proxy = null) {
        this.wallet = wallet.toLowerCase(); // Ensure lowercase for consistency with API
        this.botIndex = botIndex;
        this.proxy = proxy;
        this.currentEarnings = { total: 0 };
        this.miningState = {
            isActive: false,
            worker: "quantum-rig-1",
            pool: "quantum-1",
            startTime: null,
            lastUpdate: null
        };
        this.referralBonus = 0;
        this.stats = {
            hashrate: MINING_CONFIG.DEFAULT_HASHRATE,
            shares: { accepted: 0, rejected: 0 },
            efficiency: MINING_CONFIG.DEFAULT_EFFICIENCY,
            powerUsage: MINING_CONFIG.DEFAULT_POWER_USAGE
        };
        // Use a dedicated session folder
        const sessionDir = path.join(getRootDir(), 'session');
        this.sessionDir = sessionDir;
        this.sessionFile = path.join(sessionDir, `${wallet}.json`);
        
        // Create session directory if it doesn't exist
        this.ensureSessionDir();
        
        // Setup API with proxy if provided
        this.api = setupAxiosWithProxy({
            baseURL: API_CONFIG.BASE_URL,
            headers: API_CONFIG.HEADERS
        }, proxy);
    }

    /**
     * Ensure the session directory exists
     */
    async ensureSessionDir() {
        try {
            // Check if directory exists
            try {
                await fs.access(this.sessionDir);
            } catch (e) {
                // Directory doesn't exist, create it
                await fs.mkdir(this.sessionDir, { recursive: true });
                if (DEBUG.VERBOSE) {
                    console.log(chalk.blue(`Created session directory: ${this.sessionDir}`));
                }
            }
        } catch (error) {
            if (DEBUG.LOG_ERRORS) {
                console.error(chalk.red(`Error creating session directory: ${error.message}`));
            }
        }
    }
    
    /**
     * Load previous session data if available
     */
    async loadSession() {
        try {
            const data = await fs.readFile(this.sessionFile, 'utf8');
            const session = JSON.parse(data);
            this.miningState.startTime = session.startTime;
            this.currentEarnings = session.earnings;
            this.referralBonus = session.referralBonus;
            console.log(chalk.green(`[Wallet ${this.botIndex}] Previous session loaded successfully`));
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Save current session data
     */
    async saveSession() {
        const sessionData = {
            startTime: this.miningState.startTime,
            earnings: this.currentEarnings,
            referralBonus: this.referralBonus
        };
        
        try {
            await fs.writeFile(this.sessionFile, JSON.stringify(sessionData, null, 2));
        } catch (error) {
            if (DEBUG.LOG_ERRORS) {
                console.error(chalk.red(`[Wallet ${this.botIndex}] Failed to save session:`, error.message));
            }
        }
    }

    /**
     * Initialize the mining bot
     */
    async initialize() {
        try {
            // 1. Check registration status
            if (DEBUG.VERBOSE) {
                console.log(chalk.blue(`[Wallet ${this.botIndex}] Checking registration for ${this.wallet}...`));
            }
            
            const regResponse = await this.retryRequest(
                () => this.api.get(`/check-registration?wallet=${this.wallet}`),
                "Registration check"
            );

            if (!regResponse.data.isRegistered) {
                throw new Error('Wallet not registered');
            }

            // 2. Try to load previous session
            const hasSession = await this.loadSession();
            
            if (!hasSession) {
                // Only initialize new values if no previous session exists
                this.referralBonus = regResponse.data.userData?.referralBonus || 0;
                this.currentEarnings = {
                    total: regResponse.data.userData?.balance || 0
                };
                this.miningState.startTime = Date.now();
            }

            // 3. Start mining session
            this.miningState.isActive = true;
            this.miningState.lastUpdate = new Date().toISOString();
            
            console.log(chalk.green(`[Wallet ${this.botIndex}] Mining ${hasSession ? 'resumed' : 'initialized'} successfully`));
            if (this.proxy) {
                console.log(chalk.blue(`[Wallet ${this.botIndex}] Using proxy: ${this.proxy}`));
            }
            
            await this.startMiningLoop();

        } catch (error) {
            if (DEBUG.LOG_ERRORS) {
                console.error(chalk.red(`[Wallet ${this.botIndex}] Initialization failed:`), error.message);
                if (error.response) {
                    console.error(chalk.red(`[Wallet ${this.botIndex}] Response status:`, error.response.status));
                    console.error(chalk.red(`[Wallet ${this.botIndex}] Response data:`, JSON.stringify(error.response.data, null, 2)));
                }
            }
            this.miningState.isActive = false;
        }
    }

    /**
     * Retry API requests with backoff
     */
    async retryRequest(requestFn, operationName, retries = 3) {
        for (let i = 0; i < retries; i++) {
            try {
                return await requestFn();
            } catch (error) {
                if (i === retries - 1) {
                    if (DEBUG.LOG_ERRORS) {
                        console.error(chalk.red(`[${operationName}] Failed after ${retries} attempts`));
                        if (error.response) {
                            console.error(chalk.red(`Response status: ${error.response.status}`));
                            console.error(chalk.red(`Response data: ${JSON.stringify(error.response.data || {}, null, 2)}`));
                        }
                    }
                    throw error;
                }
                if (DEBUG.VERBOSE) {
                    console.log(chalk.yellow(`[${operationName}] Retrying (${i + 1}/${retries})...`));
                }
                await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
            }
        }
    }

    /**
     * Calculate mining earnings based on time elapsed
     */
    calculateEarnings() {
        const timeElapsed = (Date.now() - this.miningState.startTime) / 1000;
        return (this.stats.hashrate * timeElapsed * MINING_CONFIG.EARNINGS_RATE) * (1 + this.referralBonus);
    }

    /**
     * Calculate session earnings since last update
     */
    calculateSessionEarnings() {
        const now = Date.now();
        const timeElapsed = (now - (this.miningState.lastUpdate ? new Date(this.miningState.lastUpdate).getTime() : this.miningState.startTime)) / 1000;
        const earnings = (this.stats.hashrate * timeElapsed * MINING_CONFIG.EARNINGS_RATE) * (1 + this.referralBonus);
        this.miningState.lastUpdate = new Date(now).toISOString();
        return earnings;
    }

    /**
     * Update balance with the server
     */
    async updateBalance(finalUpdate = false) {
        try {
            // Calculate session earnings since last update
            const sessionEarnings = this.calculateSessionEarnings();
            
            // Use the format from the real API call
            const payload = {
                wallet: this.wallet,
                earnings: {
                    session: sessionEarnings,
                    type: "mining_update"
                }
            };

            if (DEBUG.VERBOSE) {
                console.log(chalk.blue(`[Wallet ${this.botIndex}] Sending update with payload: ${JSON.stringify(payload)}`));
            }

            const response = await this.retryRequest(
                () => this.api.post('/update-balance', payload),
                "Balance update"
            );

            if (response.data.success) {
                this.currentEarnings.total = response.data.balance;
                await this.saveSession();
                this.logStatus(finalUpdate);
            } else {
                if (DEBUG.LOG_ERRORS) {
                    console.error(chalk.red(`[Wallet ${this.botIndex}] Update failed: Server returned success=false`));
                    if (response.data) {
                        console.error(chalk.red(`[Wallet ${this.botIndex}] Response data:`, JSON.stringify(response.data, null, 2)));
                    }
                }
            }
        } catch (error) {
            if (DEBUG.LOG_ERRORS) {
                console.error(chalk.red(`[Wallet ${this.botIndex}] Update failed:`, error.message));
                if (error.response) {
                    console.error(chalk.red(`[Wallet ${this.botIndex}] Status code:`, error.response.status));
                    console.error(chalk.red(`[Wallet ${this.botIndex}] Response data:`, JSON.stringify(error.response.data || {}, null, 2)));
                }
            }
        }
    }

    /**
     * Log current mining status
     */
    logStatus(final = false) {
        const statusType = final ? "Final Status" : "Mining Status";
        const uptime = ((Date.now() - this.miningState.startTime) / 1000).toFixed(0);
        
        console.log(chalk.yellow(`
        === [Wallet ${this.botIndex}] ${statusType} ===
        Wallet: ${this.wallet}
        Uptime: ${uptime}s | Active: ${this.miningState.isActive}
        Hashrate: ${this.stats.hashrate} MH/s
        Total Balance: ${chalk.cyan(this.currentEarnings.total.toFixed(8))} KLDO
        Referral Bonus: ${chalk.magenta(`+${(this.referralBonus * 100).toFixed(1)}%`)}
        ${this.proxy ? `Proxy: ${chalk.blue(this.proxy)}` : ''}
        `));
    }

    /**
     * Start the mining loop
     */
    async startMiningLoop() {
        while (this.miningState.isActive) {
            try {
                await this.updateBalance();
                await new Promise(resolve => setTimeout(resolve, MINING_CONFIG.UPDATE_INTERVAL));
            } catch (error) {
                if (DEBUG.LOG_ERRORS) {
                    console.error(chalk.red(`[Wallet ${this.botIndex}] Error in mining loop:`, error.message));
                }
                // Wait a bit before retrying if there's an error
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    /**
     * Stop mining and save final state
     */
    async stop() {
        try {
            console.log(chalk.yellow(`[Wallet ${this.botIndex}] Stopping miner...`));
            this.miningState.isActive = false;
            await this.updateBalance(true);
            await this.saveSession();
            console.log(chalk.green(`[Wallet ${this.botIndex}] Miner stopped successfully`));
            return this.currentEarnings.total;
        } catch (error) {
            if (DEBUG.LOG_ERRORS) {
                console.error(chalk.red(`[Wallet ${this.botIndex}] Error stopping miner:`, error.message));
            }
            return this.currentEarnings.total;
        }
    }
}