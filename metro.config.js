const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Default worker count (one per CPU) exhausted memory on this machine
// ("Fatal process out of memory: Zone"). Keep the pool small.
config.maxWorkers = 2;

module.exports = config;
