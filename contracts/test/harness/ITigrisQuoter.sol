// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ITigrisRouter} from "../../src/interfaces/external/ITigrisRouter.sol";

/// @dev Read-only Router methods used by tests and scripts to build minimums.
interface ITigrisQuoter {
    function getAmountsOut(uint256 amountIn, ITigrisRouter.Route[] memory routes)
        external
        view
        returns (uint256[] memory amounts);

    function quoteRemoveLiquidity(address tokenA, address tokenB, bool stable, address factory, uint256 liquidity)
        external
        view
        returns (uint256 amountA, uint256 amountB);
}
