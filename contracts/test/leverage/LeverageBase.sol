// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {LeverageHarness} from "../harness/LeverageHarness.sol";
import {MezoRouteLeverage} from "../../src/MezoRouteLeverage.sol";
import {IMezoRouteLeverage} from "../../src/interfaces/IMezoRouteLeverage.sol";

/// @dev Deploys MezoRouteLeverage on the harness and builds params from the live pool state.
///      Helpers make external calls, so build params BEFORE `vm.prank`.
abstract contract LeverageBase is LeverageHarness {
    uint256 internal constant FEE_BPS = 10;
    uint256 internal constant MAX_BTC_FLASH = 12e18;
    uint256 internal constant MAX_MUSD_FLASH = 1_000_000e18;
    uint256 internal constant DEV_BPS = 500;

    MezoRouteLeverage internal leverage;

    function setUp() public virtual override {
        super.setUp();
        leverage = _deploy(FEE_BPS, MAX_BTC_FLASH, MAX_MUSD_FLASH);
    }

    function _config(uint256 feeBps, uint256 maxBtcFlash, uint256 maxMusdFlash)
        internal
        view
        returns (IMezoRouteLeverage.Config memory)
    {
        return IMezoRouteLeverage.Config({
            musd: address(musd),
            btc: address(btc),
            factory: address(factory),
            pool: pool,
            borrowerOperationsSignatures: address(protocol),
            troveManager: address(protocol),
            priceFeed: address(priceFeed),
            feeBps: feeBps,
            feeRecipient: feeRecipient,
            maxBtcFlash: maxBtcFlash,
            maxMusdFlash: maxMusdFlash
        });
    }

    function _deploy(uint256 feeBps, uint256 maxBtcFlash, uint256 maxMusdFlash) internal returns (MezoRouteLeverage) {
        return new MezoRouteLeverage(_config(feeBps, maxBtcFlash, maxMusdFlash));
    }

    function _reserves() internal view returns (uint256 reserveMusd, uint256 reserveBtc) {
        (uint256 r0, uint256 r1,) = _getReserves();
        (reserveMusd, reserveBtc) = btcIsToken0 ? (r1, r0) : (r0, r1);
    }

    function _getReserves() internal view returns (uint256, uint256, uint256) {
        (bool ok, bytes memory out) = pool.staticcall(abi.encodeWithSignature("getReserves()"));
        require(ok, "reserves");
        return abi.decode(out, (uint256, uint256, uint256));
    }

    function _poolFee() internal view returns (uint256) {
        return factory.getFee(pool, false);
    }

    /// @dev BTC the pool needs for `musdOut`.
    function _btcIn(uint256 musdOut) internal view returns (uint256) {
        (uint256 rm, uint256 rb) = _reserves();
        return leverage.exactInput(rb, rm, musdOut, _poolFee());
    }

    /// @dev MUSD the pool needs for `btcOut`.
    function _musdIn(uint256 btcOut) internal view returns (uint256) {
        (uint256 rm, uint256 rb) = _reserves();
        return leverage.exactInput(rm, rb, btcOut, _poolFee());
    }

    function _noPermit() internal pure returns (IMezoRouteLeverage.Permit memory) {
        return IMezoRouteLeverage.Permit({value: 0, deadline: 0, v: 0, r: bytes32(0), s: bytes32(0)});
    }

    function _permitFor(address token, uint256 value) internal view returns (IMezoRouteLeverage.Permit memory p) {
        uint256 deadline = block.timestamp + 600;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(token, userKey, address(leverage), value, deadline);
        p = IMezoRouteLeverage.Permit({value: value, deadline: deadline, v: v, r: r, s: s});
    }

    function _auth(bytes memory signature) internal view returns (IMezoRouteLeverage.TroveAuth memory) {
        return IMezoRouteLeverage.TroveAuth({
            upperHint: address(0), lowerHint: address(0), signature: signature, deadline: block.timestamp + 600
        });
    }

    /// @dev Unwind params for repaying `debt`, withdrawing the pool's BTC need plus 1%.
    function _unwindParams(uint256 debt)
        internal
        view
        returns (IMezoRouteLeverage.UnwindParams memory p, IMezoRouteLeverage.TroveAuth memory a)
    {
        uint256 withdrawal = (_btcIn(debt) * 101) / 100;
        p = IMezoRouteLeverage.UnwindParams({
            debtToRepay: debt,
            collWithdrawal: withdrawal,
            maxBtcToPool: withdrawal,
            maxDeviationBps: DEV_BPS,
            deadline: block.timestamp + 600
        });
        a = _auth(_sigAdjust(user, withdrawal, debt, false, 0));
    }
}
