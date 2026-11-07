// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Vm} from "forge-std/Vm.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @dev Mezo's BTC: the ERC-20 balance and the native balance are one ledger (a chain precompile), so
///      BTC received as an ERC-20 transfer can leave as `msg.value`, and native BTC received shows in
///      `balanceOf`.
///
///      `balanceOf(a) = a.balance + delta[a] - float[a]`:
///      - native sends (`msg.value`, `call{value:}`) move the native part, which the EVM journals;
///      - ERC-20 transfers move `delta`, which is storage and therefore journaled too;
///      - `float` is native BTC given once (`fund`) to a contract that turns ERC-20 BTC into
///        `msg.value`, so it has native to send; it never counts as balance.
///      No cheatcode runs inside a transfer: `vm.deal` is not undone when a call reverts.
contract MockUnifiedBtc is ERC20Permit {
    Vm private constant VM = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    mapping(address => int256) public delta;
    mapping(address => uint256) public float;

    constructor() ERC20("BTC", "BTC") ERC20Permit("BTC") {}

    /// @dev Test setup only (never inside a call that may revert).
    function mint(address to, uint256 amount) external {
        VM.deal(to, to.balance + amount);
    }

    /// @dev Test setup only: native headroom for a contract that sends ERC-20-received BTC as msg.value.
    function fund(address account, uint256 amount) external {
        VM.deal(account, account.balance + amount);
        float[account] += amount;
    }

    function balanceOf(address account) public view override returns (uint256) {
        int256 b = int256(account.balance) + delta[account] - int256(float[account]);
        require(b >= 0, "MockUnifiedBtc: negative balance");
        return uint256(b);
    }

    function _transfer(address from, address to, uint256 amount) internal override {
        require(from != address(0) && to != address(0), "ERC20: zero address");
        require(balanceOf(from) >= amount, "ERC20: transfer amount exceeds balance");
        delta[from] -= int256(amount);
        delta[to] += int256(amount);
        emit Transfer(from, to, amount);
    }
}
