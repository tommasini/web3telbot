require('dotenv').config();
const HDWalletProvider = require('@truffle/hdwallet-provider');
const {MNEMONIC} = process.env;

module.exports = {
    compilers: {
        solc: {
            version: "0.8.9"
        }
    },
    networks: {
        development: {
            host: "127.0.0.1",
            port: 8545,
            network_id: "*"
        },
        linea: {
            provider: () => new HDWalletProvider(MNEMONIC, `https://rpc.goerli.linea.build/`),
            network_id: '59140'
        }
    }
};