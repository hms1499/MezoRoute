// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MockERC20Permit} from "./MockERC20Permit.sol";
import {MockPriceFeed} from "./MockPriceFeed.sol";

/// @dev Plays MUSD's BorrowerOperationsSignatures and TroveManager for MezoRouteLeverage tests:
///      - a signature is `abi.encode(keccak256(<what the real typehash binds, msg.value as assetAmount>), nonce)`,
///        one nonce per borrower for every signature type;
///      - repayments and closes burn MUSD from the caller (`msg.sender`), as BorrowerOperations does;
///      - a debt increase mints to `recipient` and adds a 0.1% fee to the principal;
///      - a close burns `debt - 200 MUSD` (gas compensation) and sends all collateral to `recipient`;
///      - withdrawn collateral is native BTC sent to `recipient` (Mezo's unified BTC ledger).
contract MockMusdProtocol {
    uint256 public constant GAS_COMPENSATION = 200e18;
    uint256 public constant MIN_NET_DEBT = 1_800e18;
    uint256 public constant MCR = 1.1e18;

    struct Trove {
        uint256 coll;
        uint256 principal;
        uint256 interest;
        bool active;
    }

    MockERC20Permit public immutable musd;
    MockPriceFeed public immutable priceFeed;
    mapping(address => Trove) public troves;
    mapping(address => uint256) public nonces;
    bool public recoveryMode;

    address public lastCaller;
    address public lastBorrower;
    address public lastRecipient;
    uint256 public actions;

    constructor(MockERC20Permit musd_, MockPriceFeed priceFeed_) {
        musd = musd_;
        priceFeed = priceFeed_;
    }

    receive() external payable {}

    // ---- test controls ----

    function seedTrove(address borrower, uint256 coll, uint256 principal) external {
        troves[borrower] = Trove({coll: coll, principal: principal, interest: 0, active: true});
    }

    function accrue(address borrower, uint256 interest) external {
        troves[borrower].interest += interest;
    }

    function setRecoveryMode(bool on) external {
        recoveryMode = on;
    }

    // ---- BorrowerOperationsSignatures ----

    function getNonce(address user) external view returns (uint256) {
        return nonces[user];
    }

    function adjustTroveWithSignature(
        uint256 collWithdrawal,
        uint256 debtChange,
        bool isDebtIncrease,
        address,
        address,
        address borrower,
        address recipient,
        bytes memory signature,
        uint256 deadline
    ) external payable {
        _verify(
            keccak256(
                abi.encode("AdjustTrove", collWithdrawal, debtChange, isDebtIncrease, msg.value, borrower, recipient)
            ),
            borrower,
            signature,
            deadline
        );
        _record(borrower, recipient);
        Trove storage t = troves[borrower];
        require(t.active, "BorrowerOps: Trove does not exist or is closed");
        if (collWithdrawal > 0) {
            require(!recoveryMode, "BorrowerOps: Collateral withdrawal not permitted Recovery Mode");
        }
        t.coll += msg.value;
        if (isDebtIncrease) {
            t.principal += debtChange + debtChange / 1000;
            musd.mint(recipient, debtChange);
        } else if (debtChange > 0) {
            require(
                musd.balanceOf(msg.sender) >= debtChange,
                "BorrowerOps: Caller doesnt have enough mUSD to make repayment"
            );
            musd.burn(msg.sender, debtChange);
            uint256 fromInterest = debtChange < t.interest ? debtChange : t.interest;
            t.interest -= fromInterest;
            t.principal -= debtChange - fromInterest;
            require(
                t.principal + t.interest - GAS_COMPENSATION >= MIN_NET_DEBT,
                "BorrowerOps: Trove's net debt must be greater than minimum"
            );
        }
        if (collWithdrawal > 0) {
            t.coll -= collWithdrawal;
            (bool ok,) = payable(recipient).call{value: collWithdrawal}("");
            require(ok, "send failed");
        }
        require(
            _icr(t, priceFeed.fetchPrice()) >= MCR,
            "BorrowerOps: An operation that would result in ICR < MCR is not permitted"
        );
    }

    function closeTroveWithSignature(address borrower, address recipient, bytes memory signature, uint256 deadline)
        external
    {
        _verify(keccak256(abi.encode("CloseTrove", borrower, recipient)), borrower, signature, deadline);
        _record(borrower, recipient);
        require(!recoveryMode, "BorrowerOps: Operation not permitted during Recovery Mode");
        Trove storage t = troves[borrower];
        require(t.active, "BorrowerOps: Trove does not exist or is closed");
        uint256 burnAmount = t.principal + t.interest - GAS_COMPENSATION;
        require(
            musd.balanceOf(msg.sender) >= burnAmount, "BorrowerOps: Caller doesnt have enough mUSD to make repayment"
        );
        musd.burn(msg.sender, burnAmount);
        uint256 coll = t.coll;
        delete troves[borrower];
        (bool ok,) = payable(recipient).call{value: coll}("");
        require(ok, "send failed");
    }

    function openTroveWithSignature(
        uint256 debtAmount,
        address,
        address,
        address borrower,
        address recipient,
        bytes memory signature,
        uint256 deadline
    ) external payable {
        _verify(
            keccak256(abi.encode("OpenTrove", msg.value, debtAmount, borrower, recipient)),
            borrower,
            signature,
            deadline
        );
        _record(borrower, recipient);
        require(!troves[borrower].active, "BorrowerOps: Trove is active");
        Trove storage t = troves[borrower];
        t.coll = msg.value;
        t.principal = debtAmount + debtAmount / 1000 + GAS_COMPENSATION;
        t.active = true;
        require(
            t.principal - GAS_COMPENSATION >= MIN_NET_DEBT, "BorrowerOps: Trove's net debt must be greater than minimum"
        );
        require(
            _icr(t, priceFeed.fetchPrice()) >= MCR,
            "BorrowerOps: An operation that would result in ICR < MCR is not permitted"
        );
        musd.mint(recipient, debtAmount);
    }

    // ---- TroveManager ----

    function updateSystemAndTroveInterest(address) external {}

    function getTroveDebt(address borrower) external view returns (uint256) {
        Trove storage t = troves[borrower];
        return t.principal + t.interest;
    }

    function getTroveColl(address borrower) external view returns (uint256) {
        return troves[borrower].coll;
    }

    function getCurrentICR(address borrower, uint256 price) external view returns (uint256) {
        return _icr(troves[borrower], price);
    }

    // ---- internals ----

    function _verify(bytes32 digest, address borrower, bytes memory signature, uint256 deadline) private {
        require(block.timestamp <= deadline, "Signature expired");
        require(
            keccak256(signature) == keccak256(abi.encode(digest, nonces[borrower])),
            "BorrowerOperationsSignatures: Invalid signature"
        );
        nonces[borrower]++;
    }

    function _record(address borrower, address recipient) private {
        lastCaller = msg.sender;
        lastBorrower = borrower;
        lastRecipient = recipient;
        actions++;
    }

    function _icr(Trove storage t, uint256 price) private view returns (uint256) {
        uint256 debt = t.principal + t.interest;
        if (debt == 0) return type(uint256).max;
        return (t.coll * price) / debt;
    }
}
