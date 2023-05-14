// Get instance of the Sunshine Coin contract
const lineaContract = artifacts.require("Web3telcoin");

module.exports = function (deployer) {
    // Deploy the contract
    deployer.deploy(lineaContract);
};