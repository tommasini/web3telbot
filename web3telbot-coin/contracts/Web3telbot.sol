// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SunshineCoin is Ownable, ERC20 {

    // Mapping to check if a wallet has claimed its free coins
    mapping(address => bool) public hasClaimed;

    constructor() ERC20("Web3telbot Coin", "webtel") {
        _mint(msg.sender, 1000000 * 10 ** ERC20.decimals());
    }

    // Let owner mint tokens freely
    function mintTokens(uint _amount) public onlyOwner {
        _mint(msg.sender, _amount * 10 ** ERC20.decimals());
    }

    // Let a wallet claim 100 tokens for free
    function claimTokens() public {
        require(hasClaimed[msg.sender] == false);

        _mint(msg.sender, 100 * 10 ** ERC20.decimals());
        hasClaimed[msg.sender] = true;
    }
}