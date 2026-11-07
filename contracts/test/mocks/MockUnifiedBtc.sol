// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Vm} from "forge-std/Vm.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @dev Mezo's BTC: the ERC-20 balance and the native balance are one ledger (a chain precompile).
///      Here `balanceOf` is the native balance and transfers move native balance through `vm.deal`,
///      so an ERC-20 transfer in and a `msg.value` send out hit the same number, as on Mezo.
contract MockUnifiedBtc is ERC20Permit {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    constructor() ERC20("BTC", "BTC") ERC20Permit("BTC") {}

    function mint(address to, uint256 amount) external {
        VM.deal(to, to.balance + amount);
    }

    function balanceOf(address account) public view override returns (uint256) {
        return account.balance;
    }

    function _transfer(address from, address to, uint256 amount) internal override {
        require(from != address(0) && to != address(0), "ERC20: zero address");
        require(from.balance >= amount, "ERC20: transfer amount exceeds balance");
        VM.deal(from, from.balance - amount);
        VM.deal(to, to.balance + amount);
        emit Transfer(from, to, amount);
    }
}
