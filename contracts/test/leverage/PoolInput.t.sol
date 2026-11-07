// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Pool} from "@tigris/Pool.sol";
import {IPool} from "@tigris/interfaces/IPool.sol";
import {LeverageBase} from "./LeverageBase.sol";

/// @dev Flash-borrows `out` of one token and pays `pay` of the other inside the hook.
contract FlashPayer {
    address public immutable pool;
    address public payToken;
    uint256 public pay;

    constructor(address pool_) {
        pool = pool_;
    }

    function run(uint256 amount0Out, uint256 amount1Out, address payToken_, uint256 pay_) external {
        payToken = payToken_;
        pay = pay_;
        Pool(pool).swap(amount0Out, amount1Out, address(this), hex"01");
    }

    function hook(address, uint256, uint256, bytes calldata) external {
        IERC20(payToken).transfer(pool, pay);
    }
}

abstract contract PoolInputTest is LeverageBase {
    FlashPayer internal payer;

    function setUp() public override {
        super.setUp();
        payer = new FlashPayer(pool);
        musd.mint(address(payer), 10_000_000e18);
        btc.mint(address(payer), 100e18);
    }

    function _flash(bool btcOut, uint256 out, uint256 pay) internal {
        (uint256 a0, uint256 a1) = (btcOut == btcIsToken0) ? (out, uint256(0)) : (uint256(0), out);
        payer.run(a0, a1, btcOut ? address(musd) : address(btc), pay);
    }

    function testFuzz_exactInput_isTheSmallestThePoolAccepts(uint256 out, bool btcOut) public {
        (uint256 rm, uint256 rb) = _reserves();
        (uint256 rIn, uint256 rOut) = btcOut ? (rm, rb) : (rb, rm);
        out = bound(out, 1e9, rOut / 2);
        uint256 x = leverage.exactInput(rIn, rOut, out, _poolFee());

        uint256 snap = vm.snapshot();
        vm.expectRevert(IPool.K.selector);
        _flash(btcOut, out, x - 1);
        vm.revertTo(snap);
        _flash(btcOut, out, x);
    }

    function test_exactInput_logsVectors() public {
        (uint256 rm, uint256 rb) = _reserves();
        uint256 fee = _poolFee();
        uint256[5] memory outs = [uint256(1e15), 1e17, 5e17, 1e18, 3e18];
        for (uint256 i = 0; i < outs.length; i++) {
            emit log_named_uint("btcOut", outs[i]);
            emit log_named_uint("musdIn", leverage.exactInput(rm, rb, outs[i], fee));
        }
        uint256[5] memory musdOuts = [uint256(1e18), 1_000e18, 10_000e18, 50_000e18, 200_000e18];
        for (uint256 i = 0; i < musdOuts.length; i++) {
            emit log_named_uint("musdOut", musdOuts[i]);
            emit log_named_uint("btcIn", leverage.exactInput(rb, rm, musdOuts[i], fee));
        }
        emit log_named_uint("reserveMusd", rm);
        emit log_named_uint("reserveBtc", rb);
        emit log_named_uint("fee", fee);
    }
}

contract PoolInputTestMusdFirst is PoolInputTest {
    function _btcFirst() internal pure override returns (bool) {
        return false;
    }
}

contract PoolInputTestBtcFirst is PoolInputTest {
    function _btcFirst() internal pure override returns (bool) {
        return true;
    }
}
