// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice One-transaction Unwind, Close, Leverage and Open-with-leverage on the caller's own MUSD Trove
///         through a flash swap on the MUSD/BTC Tigris pool (PRODUCT_SPEC.md §11.9).
interface IMezoRouteLeverage {
    /// @notice Constructor input (one struct: eleven arguments run callers out of stack under via-IR).
    struct Config {
        address musd;
        address btc;
        address factory;
        address pool;
        address borrowerOperationsSignatures;
        address troveManager;
        address priceFeed;
        uint256 feeBps;
        address feeRecipient;
        uint256 maxBtcFlash;
        uint256 maxMusdFlash;
    }

    struct Permit {
        uint256 value; // 0 = skip the permit, use the existing allowance
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    /// @notice A BorrowerOperationsSignatures authorisation signed by the caller; hints are unsigned.
    struct TroveAuth {
        address upperHint;
        address lowerHint;
        bytes signature;
        uint256 deadline;
    }

    struct UnwindParams {
        uint256 debtToRepay; // MUSD flashed from the pool and burned against the Trove's debt
        uint256 collWithdrawal; // BTC withdrawn to the caller (signed)
        uint256 maxBtcToPool; // most BTC the caller pays the pool; pulled in full, the rest refunded
        uint256 maxDeviationBps; // swap price may be at most this much worse than PriceFeed
        uint256 deadline;
    }

    struct CloseParams {
        uint256 maxBtcToPool;
        uint256 maxDeviationBps;
        uint256 deadline;
    }

    struct LeverageParams {
        uint256 btcToAdd; // BTC flashed from the pool and added as collateral (signed as assetAmount)
        uint256 debtIncrease; // MUSD borrowed to the caller (signed)
        uint256 maxMusdToPool; // most MUSD the caller pays the pool, before the fee
        uint256 minCollateralRatio; // the Trove's ICR after the call, 1e18
        uint256 maxDeviationBps;
        uint256 deadline;
    }

    struct OpenLeveragedParams {
        uint256 btcToFlash; // BTC flashed and added to the caller's msg.value as collateral
        uint256 debtAmount; // MUSD borrowed to the caller (signed)
        uint256 maxMusdToPool;
        uint256 minCollateralRatio;
        uint256 maxDeviationBps;
        uint256 deadline;
    }

    event Unwound(address indexed borrower, uint256 debtRepaid, uint256 collWithdrawn, uint256 btcToPool);
    event Closed(address indexed borrower, uint256 debtRepaid, uint256 collReturned, uint256 btcToPool);
    event Leveraged(
        address indexed borrower,
        uint256 btcAdded,
        uint256 debtIncrease,
        uint256 musdToPool,
        uint256 fee,
        uint256 musdSurplus
    );
    event OpenedLeveraged(
        address indexed borrower,
        uint256 btcFromUser,
        uint256 btcFlashed,
        uint256 debtAmount,
        uint256 musdToPool,
        uint256 fee,
        uint256 musdSurplus
    );

    error ZeroAmount();
    error ZeroAddress();
    error AmountAboveCap();
    error Expired();
    error FeeTooHigh();
    error PoolMismatch();
    error DeviationTooHigh();
    error MinCrBelowFloor();
    error CollateralRatioTooLow();
    error PoolInputAboveMax();
    error OracleBoundExceeded();
    error UnauthorizedHook();
    error UnexpectedBalanceChange();

    function unwind(UnwindParams calldata p, TroveAuth calldata a, Permit calldata btcPermit)
        external
        returns (uint256 btcToPool);
}
