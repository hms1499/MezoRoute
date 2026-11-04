// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IMezoRouteExecutorV2 {
    struct Permit {
        uint256 value; // 0 = skip permit, use existing allowance
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    struct Borrow {
        uint256 amount;
        address upperHint;
        address lowerHint;
        bytes signature;
        uint256 deadline;
    }

    struct EnterParams {
        uint256 musdIn;
        uint256 musdToSwap;
        uint256 minBtcFromSwap;
        uint256 minMusdAdded;
        uint256 minBtcAdded;
        uint256 minLpOut;
        uint256 deadline;
        address recipient;
        bool stake; // deposit the new LP in the gauge, credited to `recipient`
    }

    struct EnterFromBtcParams {
        uint256 btcIn;
        uint256 btcToSwap;
        uint256 minMusdFromSwap;
        uint256 minMusdAdded;
        uint256 minBtcAdded;
        uint256 minLpOut;
        uint256 deadline;
        address recipient;
        bool stake; // deposit the new LP in the gauge, credited to `recipient`
    }

    struct ExitParams {
        uint256 liquidityIn;
        uint256 minMusdRemoved;
        uint256 minBtcRemoved;
        uint256 minMusdFromSwap;
        uint256 minMusdOut;
        uint256 deadline;
        address recipient;
    }

    event Entered(
        address indexed caller,
        address indexed recipient,
        uint256 musdBorrowed,
        uint256 musdIn,
        uint256 fee,
        uint256 musdSwapped,
        uint256 btcFromSwap,
        uint256 musdAdded,
        uint256 btcAdded,
        uint256 liquidityOut,
        uint256 musdRefund,
        uint256 btcRefund
    );

    event EnteredFromBtc(
        address indexed caller,
        address indexed recipient,
        uint256 btcIn,
        uint256 fee,
        uint256 btcToSwap,
        uint256 musdFromSwap,
        uint256 musdAdded,
        uint256 btcAdded,
        uint256 liquidityOut,
        uint256 musdRefund,
        uint256 btcRefund
    );

    event Staked(address indexed recipient, uint256 liquidity);

    event Exited(
        address indexed caller,
        address indexed recipient,
        uint256 liquidityIn,
        uint256 musdRemoved,
        uint256 btcRemoved,
        uint256 musdFromSwap,
        uint256 musdOut,
        uint256 btcRefund
    );

    error ZeroAmount();
    error ZeroAddress();
    error AmountAboveCap();
    error InvalidRecipient();
    error Expired();
    error NotBorrower();
    error BorrowAmountMismatch();
    error FeeTooHigh();
    error PoolMismatch();
    error FactoryMismatch();
    error InvalidSwapAmount();
    error InsufficientSwapOutput();
    error InsufficientLiquidityOutput();
    error InsufficientFinalOutput();
    error UnexpectedBalanceDecrease();
    error GaugeMismatch();
    error GaugeUnavailable();
    error StakeNotCredited();
    error LiquidityNotReceived();

    function enter(EnterParams calldata p, Permit calldata musdPermit) external returns (uint256 liquidityOut);

    function borrowAndEnter(Borrow calldata b, Permit calldata musdPermit, EnterParams calldata p)
        external
        returns (uint256 liquidityOut);

    function enterFromBtc(EnterFromBtcParams calldata p, Permit calldata btcPermit)
        external
        returns (uint256 liquidityOut);

    function exit(ExitParams calldata p, Permit calldata lpPermit) external returns (uint256 musdOut);
}
