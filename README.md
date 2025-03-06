# K4l3id0 Mining Bot

A professional mining bot for K4l3id0 Finance testnet with proxy support.

## Features

- ✅ Private key management (automatically derives wallet addresses)
- ✅ Proxy support with 1:1 mapping (one private key to one proxy)
- ✅ Session persistence across restarts
- ✅ Centralized configuration
- ✅ Organized session storage
- ✅ Detailed status monitoring
- ✅ Graceful shutdown with earnings summary

## Installation

```bash
# Clone repository
git clone https://github.com/Usernameusernamenotavailbleisnot/K4l3id0.git
cd K4l3id0

# Install dependencies
npm install

# Setup configuration files
# (create pk.txt and optionally proxies.txt)
```

## Configuration

### Private Keys (pk.txt)

Create a `pk.txt` file in the root directory with your private keys, one per line:

```
# Format: one private key per line (with or without 0x prefix)
0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef1234
456789abcdef123456789abcdef123456789abcdef123456789abcdef12345678
```

### Proxies (proxies.txt) - Optional

For enhanced privacy and to avoid IP bans, create a `proxies.txt` file in the root directory with proxy information:

```
# Format: http://username:password@ip:port
http://user1:pass1@192.168.1.1:8080
http://user2:pass2@192.168.1.2:8080
```

Each private key will be paired with a proxy in the order they appear in the respective files. If you have more private keys than proxies, proxies will be reused in a round-robin fashion.

## Usage

```bash
# Start mining
npm start

# Or alternatively
node index.js
```

### Mining Status

The miner shows status updates for each wallet including:
- Current balance in KLDO tokens
- Mining uptime
- Hashrate
- Referral bonus information
- Proxy in use (if configured)

### Stopping the Miner

Press `Ctrl+C` to gracefully stop all miners. The program will save session data and display a final summary before exiting.

## Debug Settings

You can control logging verbosity in `src/config/constants.js`:

```javascript
export const DEBUG = {
    VERBOSE: false,         // Enable detailed logging
    LOG_API_RESPONSES: false, // Log API responses
    LOG_ERRORS: false       // Log detailed errors
};
```

## Project Structure

```
K4l3id0-mining-bot/
├── index.js                  # Main entry point
├── package.json              # Project configuration
├── pk.txt                    # Private keys file
├── proxies.txt               # Proxies configuration (optional)
├── session/                  # Session files folder (created at runtime)
│   └── *.json                # Individual session files
├── src/
│   ├── config/               # Configuration files
│   │   └── constants.js      # System constants
│   ├── services/             # Core business logic
│   │   ├── K4l3id0MiningBot.js    # Individual miner implementation
│   │   └── MiningCoordinator.js   # Coordinates multiple miners
│   ├── ui/                   # User interface components
│   │   └── banner.js         # ASCII banner
│   └── utils/                # Utility functions
│       └── utils.js          # Helper functions
```

## Customization

The mining parameters can be modified in `src/config/constants.js`:

```javascript
export const MINING_CONFIG = {
    UPDATE_INTERVAL: 30000,        // Update interval (ms)
    DEFAULT_HASHRATE: 75.5,        // Mining hashrate
    DEFAULT_EFFICIENCY: 1.4,       // Mining efficiency
    DEFAULT_POWER_USAGE: 120,      // Power usage simulation
    EARNINGS_RATE: 0.0001,         // Earnings rate coefficient
    RETRY_ATTEMPTS: 5,             // API retry attempts
    RETRY_DELAY: 3000              // Delay between retries (ms)
};
```

## Common Issues and Solutions

### 400 Bad Request Errors
- Ensure proxy format is correct
- Verify wallet addresses are valid
- Check if the wallet is registered with K4l3id0 Finance

### Connection Issues
- Check your internet connection
- Verify that proxies are online and working
- Increase retry attempts in `constants.js`

### Mining Not Starting
- Ensure your private keys are in the correct format
- Check if the derived wallets are registered
- Look for detailed errors in the console output

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This software is provided for educational purposes only. Use at your own risk.
