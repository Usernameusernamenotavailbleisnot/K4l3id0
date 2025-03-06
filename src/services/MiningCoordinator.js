import chalk from 'chalk';
import path from 'path';
import { readFile, mkdir } from 'fs/promises';
import { KaleidoMiningBot } from './KaleidoMiningBot.js';
import { displayBanner } from '../ui/banner.js';
import { getWalletFromPrivateKey, getRootDir } from '../utils/utils.js';
import { FILE_PATHS, DEBUG } from '../config/constants.js';

export class MiningCoordinator {
    static instance = null;
    
    constructor() {
        // Singleton pattern to prevent multiple instances
        if (MiningCoordinator.instance) {
            return MiningCoordinator.instance;
        }
        MiningCoordinator.instance = this;
        
        this.bots = [];
        this.totalPaid = 0;
        this.isRunning = false;
        this.isShuttingDown = false;
    }

    /**
     * Load private keys and proxies from files
     */
    async loadPrivateKeysAndProxies() {
        try {
            const rootDir = getRootDir();
            const pkPath = path.join(rootDir, FILE_PATHS.PRIVATE_KEYS);
            const proxyPath = path.join(rootDir, FILE_PATHS.PROXIES);
            
            const pkData = await readFile(pkPath, 'utf8');
            
            // Try to load proxies if they exist
            let proxyData = '';
            try {
                proxyData = await readFile(proxyPath, 'utf8');
            } catch (error) {
                console.log(chalk.yellow('No proxies.txt file found. Running without proxies.'));
            }
            
            const privateKeys = pkData.split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'));
                
            const proxies = proxyData ? proxyData.split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#')) : [];
                
            return privateKeys.map((pk, index) => {
                // Assign a proxy to each private key if available
                const proxy = proxies.length > 0 ? proxies[index % proxies.length] : null;
                return {
                    privateKey: pk,
                    proxy
                };
            });
        } catch (error) {
            console.error('Error loading private keys:', error.message);
            return [];
        }
    }

    /**
     * Start the mining coordinator
     */
    async start() {
        // Prevent multiple starts
        if (this.isRunning) {
            console.log(chalk.yellow('Mining coordinator is already running'));
            return;
        }
        
        this.isRunning = true;
        displayBanner();
        const pkAndProxies = await this.loadPrivateKeysAndProxies();
        
        if (pkAndProxies.length === 0) {
            console.log(chalk.red('No valid private keys found in pk.txt'));
            process.exit(1);
        }

        console.log(chalk.blue(`Loaded ${pkAndProxies.length} private keys\n`));
        // Ensure session directory exists
        const sessionDir = path.join(getRootDir(), 'session');
        try {
            await fs.mkdir(sessionDir, { recursive: true });
        } catch (error) {
            if (DEBUG.LOG_ERRORS) {
                console.error(chalk.red(`Error creating session directory: ${error.message}`));
            }
        }
        // Count proxies
        const uniqueProxies = new Set(pkAndProxies.filter(item => item.proxy).map(item => item.proxy));
        if (uniqueProxies.size > 0) {
            console.log(chalk.blue(`Using ${uniqueProxies.size} unique proxies\n`));
        }

        // Initialize all bots
        this.bots = [];
        for (let i = 0; i < pkAndProxies.length; i++) {
            const item = pkAndProxies[i];
            const wallet = getWalletFromPrivateKey(item.privateKey);
            
            if (!wallet) {
                console.log(chalk.red(`[Error] Invalid private key at index ${i+1}, skipping`));
                continue;
            }
            
            const bot = new KaleidoMiningBot(wallet, i + 1, item.proxy);
            this.bots.push(bot);
            bot.initialize();
        }

        // Handle shutdown
        this.setupShutdownHandler();
    }
    
    /**
     * Setup handler for graceful shutdown
     */
    setupShutdownHandler() {
        // Clear any previous handler to avoid duplicate handlers
        process.removeAllListeners('SIGINT');
        
        process.on('SIGINT', async () => {
            // Prevent multiple shutdown attempts
            if (this.isShuttingDown) {
                console.log(chalk.yellow('\nShutdown already in progress... Press Ctrl+C again to force exit.'));
                
                // Add a force exit handler for second Ctrl+C
                process.once('SIGINT', () => {
                    console.log(chalk.red('\nForced exit.'));
                    process.exit(1);
                });
                return;
            }
            
            this.isShuttingDown = true;
            console.log(chalk.yellow('\nShutting down miners... Please wait.'));
            
            try {
                // Set a timeout to force exit if shutdown takes too long
                const forceExitTimer = setTimeout(() => {
                    console.log(chalk.red('\nShutdown timeout exceeded. Forcing exit.'));
                    process.exit(1);
                }, 30000); // 30 seconds timeout
                
                // Stop all bots and collect their paid amounts
                const paidValues = await Promise.all(
                    this.bots.map(bot => {
                        try {
                            return bot.stop();
                        } catch (err) {
                            console.error(chalk.red(`Error stopping bot:`, err.message));
                            return 0;
                        }
                    })
                );
                
                // Clear the force exit timer since we completed normally
                clearTimeout(forceExitTimer);
                
                this.totalPaid = paidValues.reduce((sum, paid) => sum + paid, 0);
                
                console.log(chalk.green(`
                === Final Summary ===
                Total Wallets: ${this.bots.length}
                Total Paid: ${this.totalPaid.toFixed(8)} KLDO
                `));
                
                // Exit with success code
                process.exit(0);
            } catch (error) {
                console.error(chalk.red('Error during shutdown:', error.message));
                process.exit(1);
            }
        });
    }
}