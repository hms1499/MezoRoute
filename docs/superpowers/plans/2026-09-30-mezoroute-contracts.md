# MezoRoute Contracts (Wave 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, test, deploy, and smoke-test `MezoRouteExecutor` — the non-custodial, fixed-route executor for the Mezo MUSD/BTC pool with `enter`, `exit`, permit support, and `borrowAndEnter`.

**Architecture:** One immutable contract with no owner. Every amount it moves or reports is a balance delta measured inside the current call, so pre-existing balances can never be paid out. Tests deploy the real Tigris `Pool`/`PoolFactory`/`Router` source (pinned commit) locally with mock MUSD/BTC, because Mezo's BTC token is a chain precompile and cannot be forked. Real-chain behaviour is covered by a `cast` smoke script against Mezo testnet.

**Tech Stack:** Solidity 0.8.24, Foundry (forge 1.5.x), OpenZeppelin Contracts v4.9.0, Tigris @ `0a3b5e840ac8e187cc705fbeddcf00f88b09247e`, `cast`, Python 3 (smoke-script arithmetic).

**Spec:** `PRODUCT_SPEC.md` (v2.1) — Sections 4, 10, 11, 14, 16 (tasks T1, T2, T3, T8, T9, T12).

This is plan 1 of 2. The frontend (T4–T7, T10, T11, T13–T16) gets its own plan once this contract's ABI and testnet address exist.

## Global Constraints

- Do not start before **16 Oct 2026** (hackathon rule: product code is written during the event).
- All contract code lives in `contracts/` at the repository root.
- `solc_version = "0.8.24"`, `evm_version = "london"` (Mezo supports London only), `via_ir = true`, optimizer 200 runs.
- OpenZeppelin Contracts **v4.9.0** (same as Tigris; import paths such as `security/ReentrancyGuard.sol`).
- Tigris pinned to commit `0a3b5e840ac8e187cc705fbeddcf00f88b09247e`.
- No owner, no pause, no proxy, no admin withdrawal. Everything is `immutable`.
- `MAX_FEE_BPS = 50`; proposed deployed fee `10` bps; fee only on entry.
- Borrowed MUSD recipient is always the caller (spec 11.4).
- Testnet addresses (spec 11.1): MUSD `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`, BTC `0x7b7C000000000000000000000000000000000000`, Router `0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9`, PoolFactory `0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A`, Pool `0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9`, BorrowerOperationsSignatures `0xD757e3646AF370b15f32EB557F0F8380Df7D639e`.
- Run `forge fmt` before every commit; `forge fmt --check` must pass.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

Five inputs the spec implies that are easy to get wrong; each has a pinning test in the owning task:

1. **Residue goes to `recipient`, not `msg.sender`, when they differ** (e.g. a frontend bug sends LP to another address) — Task 2 `test_enter_refundsResidueToRecipientNotCaller`.
2. **`deadline == block.timestamp` must succeed**, not revert (off-by-one against the Router's own check) — Task 2 `test_enter_acceptsDeadlineEqualToNow`.
3. **Dust LP exit (1 wei)** must revert rather than burn LP for nothing — Task 3 `test_exit_dustLiquidityReverts`.
4. **Permit signed for less than `musdIn`** must revert cleanly, never pull a partial amount — Task 4 `test_enter_revertsWhenPermitValueBelowAmount`.
5. **Real BTC precompile token and real Tigris deployment differ from mocks** (transfer semantics, pool fee, EIP-712 domain of LP clones) — Task 7 live smoke script, plus `test_exit_withLpPermit` pinning the empty-name LP domain.

---

### Task 1: Foundry scaffold, dependencies, mocks, and Tigris sanity test

**Files:**
- Create: `contracts/foundry.toml`, `contracts/remappings.txt`, `contracts/.gitignore`
- Create: `contracts/src/interfaces/external/ITigrisRouter.sol`
- Create: `contracts/src/interfaces/external/IBorrowerOperationsSignatures.sol`
- Create: `contracts/test/harness/ITigrisQuoter.sol`
- Create: `contracts/test/mocks/MockERC20Permit.sol`, `contracts/test/mocks/MockFactoryRegistry.sol`, `contracts/test/mocks/MockBorrowerOperationsSignatures.sol`
- Test: `contracts/test/TigrisSetup.t.sol`

**Interfaces:**
- Produces: `ITigrisRouter` (struct `Route{from,to,stable,factory}`, `poolFor`, `swapExactTokensForTokens`, `addLiquidity`, `removeLiquidity`); `IBorrowerOperationsSignatures.withdrawMUSDWithSignature(uint256,address,address,address,address,bytes,uint256)`; `ITigrisQuoter` (`getAmountsOut`, `quoteRemoveLiquidity`); `MockERC20Permit(name,symbol)` with `mint(to,amount)`; `MockFactoryRegistry`; `MockBorrowerOperationsSignatures(MockERC20Permit)` with `lastBorrower()`, `lastRecipient()`.

- [ ] **Step 1: Create the Foundry project and install pinned dependencies**

Run from the repository root:

```bash
forge init contracts --no-git
cd contracts
rm -rf lib src test script README.md
mkdir -p src/interfaces/external test/harness test/mocks test/invariant script
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v4.9.0 mezo-org/tigris@0a3b5e840ac8e187cc705fbeddcf00f88b09247e
```

Expected: `.gitmodules` at the repo root lists `contracts/lib/forge-std`, `contracts/lib/openzeppelin-contracts`, `contracts/lib/tigris`, and `contracts/foundry.lock` exists. (`rm -rf lib` first: `forge init --no-git` copies a non-submodule forge-std that makes `forge install` fail.)

- [ ] **Step 2: Write `contracts/foundry.toml`**

```toml
[profile.default]
src = "src"
test = "test"
script = "script"
libs = ["lib"]
solc_version = "0.8.24"
evm_version = "london"
optimizer = true
optimizer_runs = 200
via_ir = true

[fuzz]
runs = 256

[invariant]
runs = 64
depth = 32
fail_on_revert = false

[rpc_endpoints]
mezo_testnet = "https://rpc.test.mezo.org"
mezo_mainnet = "https://mainnet.mezo.public.validationcloud.io"

[lint]
lint_on_build = false
```

- [ ] **Step 3: Write `contracts/remappings.txt` and `contracts/.gitignore`**

```
@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
forge-std/=lib/forge-std/src/
@tigris/=lib/tigris/solidity/contracts/
```

```
out/
cache/
broadcast/*/31611/dry-run/
broadcast/*/31612/dry-run/
.env
```

- [ ] **Step 4: Write the failing sanity test `contracts/test/TigrisSetup.t.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Pool} from "@tigris/Pool.sol";
import {PoolFactory} from "@tigris/factories/PoolFactory.sol";
import {Router} from "@tigris/Router.sol";
import {ITigrisRouter} from "../src/interfaces/external/ITigrisRouter.sol";
import {ITigrisQuoter} from "./harness/ITigrisQuoter.sol";
import {MockERC20Permit} from "./mocks/MockERC20Permit.sol";
import {MockFactoryRegistry} from "./mocks/MockFactoryRegistry.sol";

/// @dev Proves the pinned Tigris sources compile under our toolchain and behave like the live pool.
contract TigrisSetupTest is Test {
    function test_realTigrisContractsDeploySeedAndQuote() public {
        MockERC20Permit musd = new MockERC20Permit("Mezo USD", "MUSD");
        MockERC20Permit btc = new MockERC20Permit("BTC", "BTC");
        PoolFactory factory = new PoolFactory(address(new Pool()));
        Router router = new Router(address(0), address(new MockFactoryRegistry()), address(factory));
        address pool = factory.createPool(address(musd), address(btc), false);

        assertEq(ITigrisRouter(address(router)).poolFor(address(musd), address(btc), false, address(factory)), pool);

        musd.mint(address(this), 1_000_000e18);
        btc.mint(address(this), 10e18);
        musd.approve(address(router), type(uint256).max);
        btc.approve(address(router), type(uint256).max);
        (,, uint256 liquidity) = ITigrisRouter(address(router))
            .addLiquidity(address(musd), address(btc), false, 1_000_000e18, 10e18, 0, 0, address(this), block.timestamp);
        assertGt(liquidity, 0);

        ITigrisRouter.Route[] memory routes = new ITigrisRouter.Route[](1);
        routes[0] = ITigrisRouter.Route(address(musd), address(btc), false, address(factory));
        uint256 btcOut = ITigrisQuoter(address(router)).getAmountsOut(1_000e18, routes)[1];
        // 1,000 MUSD at 100,000 MUSD/BTC is 0.01 BTC before the 0.3% fee and price impact.
        assertGt(btcOut, 0.0099e18);
        assertLt(btcOut, 0.01e18);
    }
}
```

- [ ] **Step 5: Run it to verify it fails**

Run: `cd contracts && forge test --match-contract TigrisSetupTest`
Expected: compilation error — `ITigrisRouter`, `ITigrisQuoter`, `MockERC20Permit`, `MockFactoryRegistry` not found.

- [ ] **Step 6: Write `contracts/src/interfaces/external/ITigrisRouter.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Subset of the Mezo Tigris basic Router used by MezoRoute.
interface ITigrisRouter {
    struct Route {
        address from;
        address to;
        bool stable;
        address factory;
    }

    function poolFor(address tokenA, address tokenB, bool stable, address factory) external view returns (address pool);

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function addLiquidity(
        address tokenA,
        address tokenB,
        bool stable,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);

    function removeLiquidity(
        address tokenA,
        address tokenB,
        bool stable,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);
}
```

- [ ] **Step 7: Write `contracts/src/interfaces/external/IBorrowerOperationsSignatures.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Subset of MUSD BorrowerOperationsSignatures used by MezoRoute.
interface IBorrowerOperationsSignatures {
    function withdrawMUSDWithSignature(
        uint256 amount,
        address upperHint,
        address lowerHint,
        address borrower,
        address recipient,
        bytes memory signature,
        uint256 deadline
    ) external;
}
```

- [ ] **Step 8: Write `contracts/test/harness/ITigrisQuoter.sol`**

```solidity
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
```

- [ ] **Step 9: Write the three mocks**

`contracts/test/mocks/MockERC20Permit.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract MockERC20Permit is ERC20Permit {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) ERC20Permit(name_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
```

`contracts/test/mocks/MockFactoryRegistry.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @dev The Tigris Router only asks the registry whether a factory is approved.
contract MockFactoryRegistry {
    function isPoolFactoryApproved(address) external pure returns (bool) {
        return true;
    }
}
```

`contracts/test/mocks/MockBorrowerOperationsSignatures.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MockERC20Permit} from "./MockERC20Permit.sol";

/// @dev Mimics the parts of MUSD BorrowerOperationsSignatures the executor relies on:
///      anyone may submit a signature, each signature works once, and MUSD goes to `recipient`.
contract MockBorrowerOperationsSignatures {
    MockERC20Permit public immutable musd;
    mapping(bytes32 => bool) public used;

    address public lastBorrower;
    address public lastRecipient;

    constructor(MockERC20Permit musd_) {
        musd = musd_;
    }

    function withdrawMUSDWithSignature(
        uint256 amount,
        address,
        address,
        address borrower,
        address recipient,
        bytes memory signature,
        uint256 deadline
    ) external {
        require(block.timestamp <= deadline, "Signature expired");
        bytes32 key = keccak256(abi.encode(signature, borrower, recipient, amount));
        require(!used[key], "BorrowerOperationsSignatures: Invalid signature");
        used[key] = true;
        lastBorrower = borrower;
        lastRecipient = recipient;
        musd.mint(recipient, amount);
    }
}
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `cd contracts && forge test --match-contract TigrisSetupTest -vv`
Expected: `[PASS] test_realTigrisContractsDeploySeedAndQuote()`

- [ ] **Step 11: Format and commit**

```bash
cd contracts && forge fmt && forge fmt --check && cd ..
git add .gitmodules contracts
git commit -m "chore(contracts): scaffold Foundry project with pinned Tigris and mocks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Executor constructor and `enter` (fee, residual isolation, minimums)

**Files:**
- Create: `contracts/src/interfaces/IMezoRouteExecutor.sol`
- Create: `contracts/src/MezoRouteExecutor.sol`
- Create: `contracts/test/harness/TigrisHarness.sol`
- Test: `contracts/test/Enter.t.sol`

**Interfaces:**
- Consumes: everything from Task 1.
- Produces: `IMezoRouteExecutor` with `Permit`, `EnterParams`, `Entered`, errors, `enter(EnterParams,Permit) returns (uint256 liquidityOut)`; `MezoRouteExecutor(musd, btc, router, factory, pool, borrowerOperationsSignatures, feeBps, feeRecipient)` with public immutables `musd`, `btc`, `pool`, `router`, `factory`, `borrowerOperationsSignatures`, `feeBps`, `feeRecipient`, constant `MAX_FEE_BPS`; private `_enter(EnterParams, Permit, uint256 musdBorrowed)`. `TigrisHarness` with `musd`, `btc`, `factory`, `router`, `pool`, `bos`, `executor`, `feeRecipient`, `seeder`, `userKey`, `user`, virtual `_newMusd()`, `_deployExecutor(uint256)`, `_noPermit()`, `_enterParams(uint256,address)`, `_quoteSwap(address,address,uint256)`, `_fund(address,uint256)`.

- [ ] **Step 1: Write the harness `contracts/test/harness/TigrisHarness.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Pool} from "@tigris/Pool.sol";
import {PoolFactory} from "@tigris/factories/PoolFactory.sol";
import {Router} from "@tigris/Router.sol";
import {MezoRouteExecutor} from "../../src/MezoRouteExecutor.sol";
import {IMezoRouteExecutor} from "../../src/interfaces/IMezoRouteExecutor.sol";
import {ITigrisRouter} from "../../src/interfaces/external/ITigrisRouter.sol";
import {MockERC20Permit} from "../mocks/MockERC20Permit.sol";
import {MockFactoryRegistry} from "../mocks/MockFactoryRegistry.sol";
import {MockBorrowerOperationsSignatures} from "../mocks/MockBorrowerOperationsSignatures.sol";
import {ITigrisQuoter} from "./ITigrisQuoter.sol";

/// @dev Deploys the real Tigris Pool, PoolFactory and Router (pinned commit) with mock MUSD/BTC.
///      Mezo's BTC token is backed by a chain precompile, so it cannot be used on a local fork.
abstract contract TigrisHarness is Test {
    uint256 internal constant FEE_BPS = 10;
    uint256 internal constant SEED_MUSD = 1_000_000e18;
    uint256 internal constant SEED_BTC = 10e18; // 1 BTC = 100,000 MUSD

    MockERC20Permit internal musd;
    MockERC20Permit internal btc;
    PoolFactory internal factory;
    Router internal router;
    address internal pool;
    MockBorrowerOperationsSignatures internal bos;
    MezoRouteExecutor internal executor;

    address internal feeRecipient = makeAddr("feeRecipient");
    address internal seeder = makeAddr("seeder");
    uint256 internal userKey = 0xA11CE;
    address internal user = vm.addr(userKey);

    function setUp() public virtual {
        musd = _newMusd();
        btc = new MockERC20Permit("BTC", "BTC");
        factory = new PoolFactory(address(new Pool()));
        router = new Router(address(0), address(new MockFactoryRegistry()), address(factory));
        pool = factory.createPool(address(musd), address(btc), false);
        bos = new MockBorrowerOperationsSignatures(musd);

        musd.mint(seeder, SEED_MUSD);
        btc.mint(seeder, SEED_BTC);
        vm.startPrank(seeder);
        musd.approve(address(router), SEED_MUSD);
        btc.approve(address(router), SEED_BTC);
        router.addLiquidity(address(musd), address(btc), false, SEED_MUSD, SEED_BTC, 0, 0, seeder, block.timestamp);
        vm.stopPrank();

        executor = _deployExecutor(FEE_BPS);
    }

    function _newMusd() internal virtual returns (MockERC20Permit) {
        return new MockERC20Permit("Mezo USD", "MUSD");
    }

    function _deployExecutor(uint256 feeBps) internal returns (MezoRouteExecutor) {
        return new MezoRouteExecutor(
            address(musd), address(btc), address(router), address(factory), pool, address(bos), feeBps, feeRecipient
        );
    }

    function _noPermit() internal pure returns (IMezoRouteExecutor.Permit memory) {
        return IMezoRouteExecutor.Permit({value: 0, deadline: 0, v: 0, r: bytes32(0), s: bytes32(0)});
    }

    /// @dev Swaps half of the post-fee amount; minimums at 1% below the pre-trade quote.
    ///      Makes external calls, so build params BEFORE `vm.prank`.
    function _enterParams(uint256 musdIn, address recipient)
        internal
        view
        returns (IMezoRouteExecutor.EnterParams memory p)
    {
        uint256 net = musdIn - (musdIn * executor.feeBps()) / 10_000;
        uint256 musdToSwap = net / 2;
        uint256 btcOut = _quoteSwap(address(musd), address(btc), musdToSwap);
        p = IMezoRouteExecutor.EnterParams({
            musdIn: musdIn,
            musdToSwap: musdToSwap,
            minBtcFromSwap: (btcOut * 99) / 100,
            minMusdAdded: 0,
            minBtcAdded: 0,
            minLpOut: 0,
            deadline: block.timestamp + 600,
            recipient: recipient
        });
    }

    function _quoteSwap(address from, address to, uint256 amountIn) internal view returns (uint256) {
        ITigrisRouter.Route[] memory routes = new ITigrisRouter.Route[](1);
        routes[0] = ITigrisRouter.Route({from: from, to: to, stable: false, factory: address(factory)});
        return ITigrisQuoter(address(router)).getAmountsOut(amountIn, routes)[1];
    }

    function _fund(address who, uint256 amount) internal {
        musd.mint(who, amount);
        vm.prank(who);
        musd.approve(address(executor), type(uint256).max);
    }
}
```

- [ ] **Step 2: Write the failing tests `contracts/test/Enter.t.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Vm} from "forge-std/Vm.sol";
import {TigrisHarness} from "./harness/TigrisHarness.sol";
import {IMezoRouteExecutor} from "../src/interfaces/IMezoRouteExecutor.sol";
import {MezoRouteExecutor} from "../src/MezoRouteExecutor.sol";

contract EnterTest is TigrisHarness {
    function test_enter_mintsLpToRecipientAndChargesFee() public {
        _fund(user, 1_000e18);
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);

        vm.prank(user);
        uint256 liquidityOut = executor.enter(p, _noPermit());

        assertGt(liquidityOut, 0);
        assertEq(IERC20(pool).balanceOf(user), liquidityOut);
        assertEq(musd.balanceOf(feeRecipient), 1e18); // 10 bps of 1,000 MUSD
        assertEq(musd.balanceOf(address(executor)), 0);
        assertEq(btc.balanceOf(address(executor)), 0);
        assertEq(IERC20(pool).balanceOf(address(executor)), 0);
    }

    function test_enter_emitsEventMatchingBalanceChanges() public {
        _fund(user, 1_000e18);
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);

        vm.recordLogs();
        vm.prank(user);
        uint256 liquidityOut = executor.enter(p, _noPermit());

        Vm.Log[] memory logs = vm.getRecordedLogs();
        Vm.Log memory entered = logs[logs.length - 1];
        assertEq(entered.topics[0], IMezoRouteExecutor.Entered.selector);
        (
            uint256 musdBorrowed,
            uint256 musdIn,
            uint256 fee,
            uint256 musdSwapped,,
            uint256 musdAdded,,
            uint256 lpOut,
            uint256 musdRefund,
        ) = abi.decode(
            entered.data, (uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256)
        );
        assertEq(musdBorrowed, 0);
        assertEq(musdIn, 1_000e18);
        assertEq(fee, 1e18);
        assertEq(musdSwapped, p.musdToSwap);
        assertEq(lpOut, liquidityOut);
        assertEq(musdIn - fee, musdSwapped + musdAdded + musdRefund);
        assertEq(musd.balanceOf(user), musdRefund);
    }

    function test_enter_neverPaysOutPreExistingBalances() public {
        musd.mint(address(executor), 500e18);
        btc.mint(address(executor), 1e18);
        _fund(user, 1_000e18);
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);

        vm.prank(user);
        executor.enter(p, _noPermit());

        assertEq(musd.balanceOf(address(executor)), 500e18);
        assertEq(btc.balanceOf(address(executor)), 1e18);
        assertLt(musd.balanceOf(user), 500e18);
        assertEq(btc.balanceOf(user) < 1e18, true);
    }

    function test_enter_leavesNoRouterAllowance() public {
        _fund(user, 1_000e18);
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        vm.prank(user);
        executor.enter(p, _noPermit());

        assertEq(musd.allowance(address(executor), address(router)), 0);
        assertEq(btc.allowance(address(executor), address(router)), 0);
    }

    function test_enter_revertsOnZeroAmount() public {
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        p.musdIn = 0;
        vm.expectRevert(IMezoRouteExecutor.ZeroAmount.selector);
        vm.prank(user);
        executor.enter(p, _noPermit());
    }

    function test_enter_revertsOnZeroRecipient() public {
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, address(0));
        vm.expectRevert(IMezoRouteExecutor.ZeroAddress.selector);
        vm.prank(user);
        executor.enter(p, _noPermit());
    }

    function test_enter_revertsWhenExpired() public {
        _fund(user, 1_000e18);
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        vm.warp(p.deadline + 1);
        vm.expectRevert(IMezoRouteExecutor.Expired.selector);
        vm.prank(user);
        executor.enter(p, _noPermit());
    }

    function test_enter_revertsWhenSwapAmountLeavesNothingToAdd() public {
        _fund(user, 1_000e18);
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        p.musdToSwap = p.musdIn; // more than the post-fee amount
        vm.expectRevert(IMezoRouteExecutor.InvalidSwapAmount.selector);
        vm.prank(user);
        executor.enter(p, _noPermit());
    }

    function test_enter_revertsWhenSwapOutputBelowMinimum() public {
        _fund(user, 1_000e18);
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        p.minBtcFromSwap = _quoteSwap(address(musd), address(btc), p.musdToSwap) + 1;
        vm.expectRevert(); // Router enforces amountOutMin first (IRouter.InsufficientOutputAmount)
        vm.prank(user);
        executor.enter(p, _noPermit());
    }

    function test_enter_revertsWhenLpBelowMinimum() public {
        _fund(user, 1_000e18);
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        p.minLpOut = type(uint256).max;
        vm.expectRevert(IMezoRouteExecutor.InsufficientLiquidityOutput.selector);
        vm.prank(user);
        executor.enter(p, _noPermit());
    }

    function test_enter_withZeroFeeExecutorChargesNothing() public {
        executor = _deployExecutor(0);
        _fund(user, 1_000e18);
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        vm.prank(user);
        executor.enter(p, _noPermit());
        assertEq(musd.balanceOf(feeRecipient), 0);
    }

    function test_fee_roundsDownOnDustAmounts() public {
        _fund(user, 1_000e18 + 999);
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        p.musdIn = 1_000e18 + 999; // 999 wei * 10 / 10_000 rounds to 0 extra
        vm.prank(user);
        executor.enter(p, _noPermit());
        assertEq(musd.balanceOf(feeRecipient), 1e18);
    }

    function test_constructor_revertsAboveMaxFee() public {
        vm.expectRevert(IMezoRouteExecutor.FeeTooHigh.selector);
        _deployExecutor(51);
    }

    function test_constructor_revertsOnPoolMismatch() public {
        vm.expectRevert(IMezoRouteExecutor.PoolMismatch.selector);
        new MezoRouteExecutor(
            address(musd),
            address(btc),
            address(router),
            address(factory),
            address(musd),
            address(bos),
            10,
            feeRecipient
        );
    }

    function test_enter_refundsResidueToRecipientNotCaller() public {
        address recipient = makeAddr("recipient");
        _fund(user, 1_000e18);
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, recipient);
        p.musdToSwap = 100e18; // unbalanced on purpose: most MUSD cannot be paired and is refunded
        p.minBtcFromSwap = 0;

        vm.prank(user);
        uint256 lp = executor.enter(p, _noPermit());

        assertEq(IERC20(pool).balanceOf(recipient), lp);
        assertGt(musd.balanceOf(recipient), 700e18);
        assertEq(musd.balanceOf(user), 0);
    }

    function test_enter_acceptsDeadlineEqualToNow() public {
        _fund(user, 1_000e18);
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        p.deadline = block.timestamp;
        vm.prank(user);
        assertGt(executor.enter(p, _noPermit()), 0);
    }
}
```

- [ ] **Step 3: Run to verify failure**

Run: `cd contracts && forge test --match-contract EnterTest`
Expected: compilation error — `MezoRouteExecutor` / `IMezoRouteExecutor` not found.

- [ ] **Step 4: Write `contracts/src/interfaces/IMezoRouteExecutor.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IMezoRouteExecutor {
    struct Permit {
        uint256 value; // 0 = skip permit, use existing allowance
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
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

    error ZeroAmount();
    error ZeroAddress();
    error Expired();
    error FeeTooHigh();
    error PoolMismatch();
    error InvalidSwapAmount();
    error InsufficientSwapOutput();
    error InsufficientLiquidityOutput();
    error UnexpectedBalanceDecrease();

    function enter(EnterParams calldata p, Permit calldata musdPermit) external returns (uint256 liquidityOut);
}
```

- [ ] **Step 5: Write `contracts/src/MezoRouteExecutor.sol`**

Note: `musdPermit` is accepted but not used yet; Task 4 wires it in.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IMezoRouteExecutor} from "./interfaces/IMezoRouteExecutor.sol";
import {ITigrisRouter} from "./interfaces/external/ITigrisRouter.sol";
import {IBorrowerOperationsSignatures} from "./interfaces/external/IBorrowerOperationsSignatures.sol";

/// @title MezoRouteExecutor
/// @notice Non-custodial, fixed-route executor for the Mezo MUSD/BTC volatile pool.
/// @dev Every amount it moves or reports is a delta measured inside the current call,
///      so balances held before a call can never be paid out or credited to a caller.
contract MezoRouteExecutor is IMezoRouteExecutor, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_FEE_BPS = 50;
    uint256 private constant BPS = 10_000;

    IERC20 public immutable musd;
    IERC20 public immutable btc;
    IERC20 public immutable pool;
    ITigrisRouter public immutable router;
    address public immutable factory;
    IBorrowerOperationsSignatures public immutable borrowerOperationsSignatures;
    uint256 public immutable feeBps;
    address public immutable feeRecipient;

    struct Balances {
        uint256 musd;
        uint256 btc;
        uint256 lp;
    }

    constructor(
        address musd_,
        address btc_,
        address router_,
        address factory_,
        address pool_,
        address borrowerOperationsSignatures_,
        uint256 feeBps_,
        address feeRecipient_
    ) {
        if (
            musd_ == address(0) || btc_ == address(0) || router_ == address(0) || factory_ == address(0)
                || pool_ == address(0) || borrowerOperationsSignatures_ == address(0) || feeRecipient_ == address(0)
        ) revert ZeroAddress();
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        if (ITigrisRouter(router_).poolFor(musd_, btc_, false, factory_) != pool_) revert PoolMismatch();

        musd = IERC20(musd_);
        btc = IERC20(btc_);
        pool = IERC20(pool_);
        router = ITigrisRouter(router_);
        factory = factory_;
        borrowerOperationsSignatures = IBorrowerOperationsSignatures(borrowerOperationsSignatures_);
        feeBps = feeBps_;
        feeRecipient = feeRecipient_;
    }

    /// @inheritdoc IMezoRouteExecutor
    function enter(EnterParams calldata p, Permit calldata musdPermit)
        external
        nonReentrant
        returns (uint256 liquidityOut)
    {
        _validateEnter(p);
        return _enter(p, musdPermit, 0);
    }

    function _enter(EnterParams calldata p, Permit calldata musdPermit, uint256 musdBorrowed)
        private
        returns (uint256 liquidityOut)
    {
        Balances memory start = _snapshot();

        musd.safeTransferFrom(msg.sender, address(this), p.musdIn);

        uint256 fee = (p.musdIn * feeBps) / BPS;
        if (fee > 0) musd.safeTransfer(feeRecipient, fee);
        if (p.musdToSwap == 0 || p.musdToSwap >= p.musdIn - fee) revert InvalidSwapAmount();

        musd.forceApprove(address(router), p.musdToSwap);
        router.swapExactTokensForTokens(
            p.musdToSwap, p.minBtcFromSwap, _route(address(musd), address(btc)), address(this), p.deadline
        );
        musd.forceApprove(address(router), 0);

        uint256 btcFromSwap = _delta(btc, start.btc);
        if (btcFromSwap < p.minBtcFromSwap) revert InsufficientSwapOutput();

        uint256 musdForLiquidity = _delta(musd, start.musd);
        musd.forceApprove(address(router), musdForLiquidity);
        btc.forceApprove(address(router), btcFromSwap);
        uint256 musdAdded;
        uint256 btcAdded;
        (musdAdded, btcAdded, liquidityOut) = router.addLiquidity(
            address(musd),
            address(btc),
            false,
            musdForLiquidity,
            btcFromSwap,
            p.minMusdAdded,
            p.minBtcAdded,
            p.recipient,
            p.deadline
        );
        musd.forceApprove(address(router), 0);
        btc.forceApprove(address(router), 0);

        if (musdAdded < p.minMusdAdded || btcAdded < p.minBtcAdded || liquidityOut < p.minLpOut) {
            revert InsufficientLiquidityOutput();
        }

        uint256 musdRefund = _delta(musd, start.musd);
        uint256 btcRefund = _delta(btc, start.btc);
        if (musdRefund > 0) musd.safeTransfer(p.recipient, musdRefund);
        if (btcRefund > 0) btc.safeTransfer(p.recipient, btcRefund);

        _assertNoDecrease(start);

        emit Entered(
            msg.sender,
            p.recipient,
            musdBorrowed,
            p.musdIn,
            fee,
            p.musdToSwap,
            btcFromSwap,
            musdAdded,
            btcAdded,
            liquidityOut,
            musdRefund,
            btcRefund
        );
    }

    function _validateEnter(EnterParams calldata p) private view {
        if (p.musdIn == 0) revert ZeroAmount();
        if (p.recipient == address(0)) revert ZeroAddress();
        if (block.timestamp > p.deadline) revert Expired();
    }

    function _route(address from, address to) private view returns (ITigrisRouter.Route[] memory routes) {
        routes = new ITigrisRouter.Route[](1);
        routes[0] = ITigrisRouter.Route({from: from, to: to, stable: false, factory: factory});
    }

    function _snapshot() private view returns (Balances memory b) {
        b.musd = musd.balanceOf(address(this));
        b.btc = btc.balanceOf(address(this));
        b.lp = pool.balanceOf(address(this));
    }

    function _delta(IERC20 token, uint256 startBalance) private view returns (uint256) {
        uint256 current = token.balanceOf(address(this));
        if (current < startBalance) revert UnexpectedBalanceDecrease();
        return current - startBalance;
    }

    function _assertNoDecrease(Balances memory start) private view {
        if (
            musd.balanceOf(address(this)) < start.musd || btc.balanceOf(address(this)) < start.btc
                || pool.balanceOf(address(this)) < start.lp
        ) revert UnexpectedBalanceDecrease();
    }
}
```

- [ ] **Step 6: Run to verify all pass**

Run: `cd contracts && forge test`
Expected: `TigrisSetupTest` 1 passed, `EnterTest` 16 passed, 0 failed.

- [ ] **Step 7: Format and commit**

```bash
cd contracts && forge fmt && forge fmt --check && cd ..
git add contracts
git commit -m "feat(contracts): add MezoRouteExecutor enter with fee and residual isolation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `exit` to MUSD

**Files:**
- Modify: `contracts/src/interfaces/IMezoRouteExecutor.sol` (full replacement below)
- Modify: `contracts/src/MezoRouteExecutor.sol` (full replacement below)
- Modify: `contracts/test/harness/TigrisHarness.sol` (add `_exitParams`)
- Test: `contracts/test/Exit.t.sol`

**Interfaces:**
- Consumes: Task 2 harness and executor.
- Produces: `IMezoRouteExecutor.ExitParams`, `Exited`, `InsufficientFinalOutput`, `exit(ExitParams,Permit) returns (uint256 musdOut)`; harness `_exitParams(uint256 liquidityIn, address recipient)`.

- [ ] **Step 1: Write the failing tests `contracts/test/Exit.t.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TigrisHarness} from "./harness/TigrisHarness.sol";
import {IMezoRouteExecutor} from "../src/interfaces/IMezoRouteExecutor.sol";

contract ExitTest is TigrisHarness {
    uint256 internal lp;

    function setUp() public override {
        super.setUp();
        _fund(user, 1_000e18);
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        vm.startPrank(user);
        lp = executor.enter(p, _noPermit());
        IERC20(pool).approve(address(executor), type(uint256).max);
        vm.stopPrank();
    }

    function test_exit_roundTripReturnsMusdMinusCosts() public {
        uint256 musdBefore = musd.balanceOf(user);
        IMezoRouteExecutor.ExitParams memory p = _exitParams(lp, user);

        vm.prank(user);
        uint256 musdOut = executor.exit(p, _noPermit());

        assertEq(musd.balanceOf(user) - musdBefore, musdOut);
        assertGt(musdOut, 990e18); // 10 bps fee + 2 x 0.3% swap fees + rounding
        assertLt(musdOut, 1_000e18);
        assertEq(IERC20(pool).balanceOf(user), 0);
        assertEq(musd.balanceOf(address(executor)), 0);
        assertEq(btc.balanceOf(address(executor)), 0);
    }

    function test_exit_chargesNoFee() public {
        uint256 feeBefore = musd.balanceOf(feeRecipient);
        IMezoRouteExecutor.ExitParams memory p = _exitParams(lp, user);
        vm.prank(user);
        executor.exit(p, _noPermit());
        assertEq(musd.balanceOf(feeRecipient), feeBefore);
    }

    function test_exit_neverPaysOutPreExistingBalances() public {
        musd.mint(address(executor), 500e18);
        btc.mint(address(executor), 1e18);
        IMezoRouteExecutor.ExitParams memory p = _exitParams(lp, user);

        vm.prank(user);
        uint256 musdOut = executor.exit(p, _noPermit());

        assertEq(musd.balanceOf(address(executor)), 500e18);
        assertEq(btc.balanceOf(address(executor)), 1e18);
        assertLt(musdOut, 1_000e18);
    }

    function test_exit_partialAmount() public {
        IMezoRouteExecutor.ExitParams memory p = _exitParams(lp / 2, user);
        vm.prank(user);
        executor.exit(p, _noPermit());
        assertEq(IERC20(pool).balanceOf(user), lp - lp / 2);
    }

    function test_exit_leavesNoRouterAllowance() public {
        IMezoRouteExecutor.ExitParams memory p = _exitParams(lp, user);
        vm.prank(user);
        executor.exit(p, _noPermit());
        assertEq(IERC20(pool).allowance(address(executor), address(router)), 0);
        assertEq(btc.allowance(address(executor), address(router)), 0);
    }

    function test_exit_revertsWhenFinalOutputBelowMinimum() public {
        IMezoRouteExecutor.ExitParams memory p = _exitParams(lp, user);
        p.minMusdOut = 1_000e18;
        vm.expectRevert(IMezoRouteExecutor.InsufficientFinalOutput.selector);
        vm.prank(user);
        executor.exit(p, _noPermit());
    }

    function test_exit_revertsOnZeroLiquidity() public {
        IMezoRouteExecutor.ExitParams memory p = _exitParams(0, user);
        vm.expectRevert(IMezoRouteExecutor.ZeroAmount.selector);
        vm.prank(user);
        executor.exit(p, _noPermit());
    }

    function test_exit_revertsWhenExpired() public {
        IMezoRouteExecutor.ExitParams memory p = _exitParams(lp, user);
        vm.warp(p.deadline + 1);
        vm.expectRevert(IMezoRouteExecutor.Expired.selector);
        vm.prank(user);
        executor.exit(p, _noPermit());
    }

    function test_exit_dustLiquidityReverts() public {
        IMezoRouteExecutor.ExitParams memory p = _exitParams(1, user);
        vm.expectRevert(); // Pool.burn reverts InsufficientLiquidityBurned; nothing is lost silently
        vm.prank(user);
        executor.exit(p, _noPermit());
        assertEq(IERC20(pool).balanceOf(user), lp);
    }

    function testFuzz_roundTrip_neverProfitsAndKeepsResidues(uint256 amount, uint256 donation) public {
        amount = bound(amount, 1e18, 50_000e18);
        donation = bound(donation, 0, 1_000e18);
        address alice = makeAddr("alice");
        musd.mint(address(executor), donation);
        btc.mint(address(executor), donation / 100_000);
        uint256 residueMusd = musd.balanceOf(address(executor));
        uint256 residueBtc = btc.balanceOf(address(executor));

        _fund(alice, amount);
        IMezoRouteExecutor.EnterParams memory ep = _enterParams(amount, alice);
        vm.startPrank(alice);
        uint256 got = executor.enter(ep, _noPermit());
        IERC20(pool).approve(address(executor), got);
        executor.exit(_exitParams(got, alice), _noPermit());
        vm.stopPrank();

        assertLe(musd.balanceOf(alice), amount);
        assertEq(musd.balanceOf(address(executor)), residueMusd);
        assertEq(btc.balanceOf(address(executor)), residueBtc);
    }
}
```

- [ ] **Step 2: Run to verify failure**

Run: `cd contracts && forge test --match-contract ExitTest`
Expected: compilation error — `ExitParams` / `_exitParams` / `exit` not found.

- [ ] **Step 3: Add `_exitParams` to `contracts/test/harness/TigrisHarness.sol`**

Insert directly after the closing brace of `_enterParams`:

```solidity
    function _exitParams(uint256 liquidityIn, address recipient)
        internal
        view
        returns (IMezoRouteExecutor.ExitParams memory p)
    {
        p = IMezoRouteExecutor.ExitParams({
            liquidityIn: liquidityIn,
            minMusdRemoved: 0,
            minBtcRemoved: 0,
            minMusdFromSwap: 0,
            minMusdOut: 0,
            deadline: block.timestamp + 600,
            recipient: recipient
        });
    }
```

- [ ] **Step 4: Replace `contracts/src/interfaces/IMezoRouteExecutor.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IMezoRouteExecutor {
    struct Permit {
        uint256 value; // 0 = skip permit, use existing allowance
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
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
    error Expired();
    error FeeTooHigh();
    error PoolMismatch();
    error InvalidSwapAmount();
    error InsufficientSwapOutput();
    error InsufficientLiquidityOutput();
    error InsufficientFinalOutput();
    error UnexpectedBalanceDecrease();

    function enter(EnterParams calldata p, Permit calldata musdPermit) external returns (uint256 liquidityOut);

    function exit(ExitParams calldata p, Permit calldata lpPermit) external returns (uint256 musdOut);
}
```

- [ ] **Step 5: Replace `contracts/src/MezoRouteExecutor.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IMezoRouteExecutor} from "./interfaces/IMezoRouteExecutor.sol";
import {ITigrisRouter} from "./interfaces/external/ITigrisRouter.sol";
import {IBorrowerOperationsSignatures} from "./interfaces/external/IBorrowerOperationsSignatures.sol";

/// @title MezoRouteExecutor
/// @notice Non-custodial, fixed-route executor for the Mezo MUSD/BTC volatile pool.
/// @dev Every amount it moves or reports is a delta measured inside the current call,
///      so balances held before a call can never be paid out or credited to a caller.
contract MezoRouteExecutor is IMezoRouteExecutor, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_FEE_BPS = 50;
    uint256 private constant BPS = 10_000;

    IERC20 public immutable musd;
    IERC20 public immutable btc;
    IERC20 public immutable pool;
    ITigrisRouter public immutable router;
    address public immutable factory;
    IBorrowerOperationsSignatures public immutable borrowerOperationsSignatures;
    uint256 public immutable feeBps;
    address public immutable feeRecipient;

    struct Balances {
        uint256 musd;
        uint256 btc;
        uint256 lp;
    }

    constructor(
        address musd_,
        address btc_,
        address router_,
        address factory_,
        address pool_,
        address borrowerOperationsSignatures_,
        uint256 feeBps_,
        address feeRecipient_
    ) {
        if (
            musd_ == address(0) || btc_ == address(0) || router_ == address(0) || factory_ == address(0)
                || pool_ == address(0) || borrowerOperationsSignatures_ == address(0) || feeRecipient_ == address(0)
        ) revert ZeroAddress();
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        if (ITigrisRouter(router_).poolFor(musd_, btc_, false, factory_) != pool_) revert PoolMismatch();

        musd = IERC20(musd_);
        btc = IERC20(btc_);
        pool = IERC20(pool_);
        router = ITigrisRouter(router_);
        factory = factory_;
        borrowerOperationsSignatures = IBorrowerOperationsSignatures(borrowerOperationsSignatures_);
        feeBps = feeBps_;
        feeRecipient = feeRecipient_;
    }

    /// @inheritdoc IMezoRouteExecutor
    function enter(EnterParams calldata p, Permit calldata musdPermit)
        external
        nonReentrant
        returns (uint256 liquidityOut)
    {
        _validateEnter(p);
        return _enter(p, musdPermit, 0);
    }

    /// @inheritdoc IMezoRouteExecutor
    function exit(ExitParams calldata p, Permit calldata lpPermit) external nonReentrant returns (uint256 musdOut) {
        if (p.liquidityIn == 0) revert ZeroAmount();
        if (p.recipient == address(0)) revert ZeroAddress();
        if (block.timestamp > p.deadline) revert Expired();

        Balances memory start = _snapshot();

        pool.safeTransferFrom(msg.sender, address(this), p.liquidityIn);

        pool.forceApprove(address(router), p.liquidityIn);
        router.removeLiquidity(
            address(musd),
            address(btc),
            false,
            p.liquidityIn,
            p.minMusdRemoved,
            p.minBtcRemoved,
            address(this),
            p.deadline
        );
        pool.forceApprove(address(router), 0);

        uint256 musdRemoved = _delta(musd, start.musd);
        uint256 btcRemoved = _delta(btc, start.btc);
        if (musdRemoved < p.minMusdRemoved || btcRemoved < p.minBtcRemoved) revert InsufficientLiquidityOutput();

        uint256 musdFromSwap;
        if (btcRemoved > 0) {
            btc.forceApprove(address(router), btcRemoved);
            router.swapExactTokensForTokens(
                btcRemoved, p.minMusdFromSwap, _route(address(btc), address(musd)), address(this), p.deadline
            );
            btc.forceApprove(address(router), 0);
            musdFromSwap = _delta(musd, start.musd) - musdRemoved;
        }
        if (musdFromSwap < p.minMusdFromSwap) revert InsufficientSwapOutput();

        musdOut = _delta(musd, start.musd);
        if (musdOut < p.minMusdOut) revert InsufficientFinalOutput();
        musd.safeTransfer(p.recipient, musdOut);

        uint256 btcRefund = _delta(btc, start.btc);
        if (btcRefund > 0) btc.safeTransfer(p.recipient, btcRefund);

        _assertNoDecrease(start);

        emit Exited(msg.sender, p.recipient, p.liquidityIn, musdRemoved, btcRemoved, musdFromSwap, musdOut, btcRefund);
    }

    function _enter(EnterParams calldata p, Permit calldata musdPermit, uint256 musdBorrowed)
        private
        returns (uint256 liquidityOut)
    {
        Balances memory start = _snapshot();

        musd.safeTransferFrom(msg.sender, address(this), p.musdIn);

        uint256 fee = (p.musdIn * feeBps) / BPS;
        if (fee > 0) musd.safeTransfer(feeRecipient, fee);
        if (p.musdToSwap == 0 || p.musdToSwap >= p.musdIn - fee) revert InvalidSwapAmount();

        musd.forceApprove(address(router), p.musdToSwap);
        router.swapExactTokensForTokens(
            p.musdToSwap, p.minBtcFromSwap, _route(address(musd), address(btc)), address(this), p.deadline
        );
        musd.forceApprove(address(router), 0);

        uint256 btcFromSwap = _delta(btc, start.btc);
        if (btcFromSwap < p.minBtcFromSwap) revert InsufficientSwapOutput();

        uint256 musdForLiquidity = _delta(musd, start.musd);
        musd.forceApprove(address(router), musdForLiquidity);
        btc.forceApprove(address(router), btcFromSwap);
        uint256 musdAdded;
        uint256 btcAdded;
        (musdAdded, btcAdded, liquidityOut) = router.addLiquidity(
            address(musd),
            address(btc),
            false,
            musdForLiquidity,
            btcFromSwap,
            p.minMusdAdded,
            p.minBtcAdded,
            p.recipient,
            p.deadline
        );
        musd.forceApprove(address(router), 0);
        btc.forceApprove(address(router), 0);

        if (musdAdded < p.minMusdAdded || btcAdded < p.minBtcAdded || liquidityOut < p.minLpOut) {
            revert InsufficientLiquidityOutput();
        }

        uint256 musdRefund = _delta(musd, start.musd);
        uint256 btcRefund = _delta(btc, start.btc);
        if (musdRefund > 0) musd.safeTransfer(p.recipient, musdRefund);
        if (btcRefund > 0) btc.safeTransfer(p.recipient, btcRefund);

        _assertNoDecrease(start);

        emit Entered(
            msg.sender,
            p.recipient,
            musdBorrowed,
            p.musdIn,
            fee,
            p.musdToSwap,
            btcFromSwap,
            musdAdded,
            btcAdded,
            liquidityOut,
            musdRefund,
            btcRefund
        );
    }

    function _validateEnter(EnterParams calldata p) private view {
        if (p.musdIn == 0) revert ZeroAmount();
        if (p.recipient == address(0)) revert ZeroAddress();
        if (block.timestamp > p.deadline) revert Expired();
    }

    function _route(address from, address to) private view returns (ITigrisRouter.Route[] memory routes) {
        routes = new ITigrisRouter.Route[](1);
        routes[0] = ITigrisRouter.Route({from: from, to: to, stable: false, factory: factory});
    }

    function _snapshot() private view returns (Balances memory b) {
        b.musd = musd.balanceOf(address(this));
        b.btc = btc.balanceOf(address(this));
        b.lp = pool.balanceOf(address(this));
    }

    function _delta(IERC20 token, uint256 startBalance) private view returns (uint256) {
        uint256 current = token.balanceOf(address(this));
        if (current < startBalance) revert UnexpectedBalanceDecrease();
        return current - startBalance;
    }

    function _assertNoDecrease(Balances memory start) private view {
        if (
            musd.balanceOf(address(this)) < start.musd || btc.balanceOf(address(this)) < start.btc
                || pool.balanceOf(address(this)) < start.lp
        ) revert UnexpectedBalanceDecrease();
    }
}
```

- [ ] **Step 6: Run to verify all pass**

Run: `cd contracts && forge test`
Expected: `EnterTest` 16, `ExitTest` 10 (including `testFuzz_roundTrip_neverProfitsAndKeepsResidues` with 256 runs), `TigrisSetupTest` 1 — 0 failed.

- [ ] **Step 7: Format and commit**

```bash
cd contracts && forge fmt && forge fmt --check && cd ..
git add contracts
git commit -m "feat(contracts): add exit to MUSD with attributable output

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: EIP-2612 permit for MUSD and LP

**Files:**
- Modify: `contracts/src/MezoRouteExecutor.sol` (full replacement below)
- Test: `contracts/test/Permit.t.sol`

**Interfaces:**
- Consumes: Task 3 executor.
- Produces: private `_tryPermit(address token, Permit calldata)`; `enter` and `exit` honour a non-zero `Permit.value`.

Domains (verified on testnet): MUSD `("Mezo USD", "1", chainId, MUSD)`; Tigris LP clones `("", "1", chainId, pool)` — empty name. The tests build digests from each token's `DOMAIN_SEPARATOR()`, which pins this behaviour.

- [ ] **Step 1: Write the failing tests `contracts/test/Permit.t.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {TigrisHarness} from "./harness/TigrisHarness.sol";
import {IMezoRouteExecutor} from "../src/interfaces/IMezoRouteExecutor.sol";

contract PermitTest is TigrisHarness {
    bytes32 internal constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    function _signPermit(address token, uint256 value) internal view returns (IMezoRouteExecutor.Permit memory) {
        uint256 deadline = block.timestamp + 600;
        bytes32 structHash = keccak256(
            abi.encode(PERMIT_TYPEHASH, user, address(executor), value, IERC20Permit(token).nonces(user), deadline)
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", IERC20Permit(token).DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userKey, digest);
        return IMezoRouteExecutor.Permit({value: value, deadline: deadline, v: v, r: r, s: s});
    }

    function test_enter_withMusdPermitNeedsNoApproval() public {
        musd.mint(user, 1_000e18);
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        IMezoRouteExecutor.Permit memory permit = _signPermit(address(musd), 1_000e18);

        vm.prank(user);
        uint256 lp = executor.enter(p, permit);

        assertGt(lp, 0);
        assertEq(musd.allowance(user, address(executor)), 0);
    }

    function test_enter_succeedsWhenPermitWasFrontRun() public {
        musd.mint(user, 1_000e18);
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        IMezoRouteExecutor.Permit memory permit = _signPermit(address(musd), 1_000e18);

        // Anyone can submit the permit first; the allowance it sets is what enter() needs.
        IERC20Permit(address(musd))
            .permit(user, address(executor), permit.value, permit.deadline, permit.v, permit.r, permit.s);

        vm.prank(user);
        assertGt(executor.enter(p, permit), 0);
    }

    function test_enter_revertsWithoutPermitOrApproval() public {
        musd.mint(user, 1_000e18);
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        vm.expectRevert("ERC20: insufficient allowance");
        vm.prank(user);
        executor.enter(p, _noPermit());
    }

    function test_exit_withLpPermit() public {
        musd.mint(user, 1_000e18);
        IMezoRouteExecutor.EnterParams memory ep = _enterParams(1_000e18, user);
        IMezoRouteExecutor.Permit memory musdPermit = _signPermit(address(musd), 1_000e18);
        vm.prank(user);
        uint256 lp = executor.enter(ep, musdPermit);

        // Tigris pools are clones with an empty EIP-712 name: the domain is ("", "1", chainId, pool).
        IMezoRouteExecutor.Permit memory lpPermit = _signPermit(pool, lp);
        IMezoRouteExecutor.ExitParams memory xp = _exitParams(lp, user);
        vm.prank(user);
        assertGt(executor.exit(xp, lpPermit), 0);
        assertEq(IERC20(pool).balanceOf(user), 0);
    }

    function test_enter_revertsWhenPermitValueBelowAmount() public {
        musd.mint(user, 1_000e18);
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        IMezoRouteExecutor.Permit memory permit = _signPermit(address(musd), 999e18);
        vm.expectRevert("ERC20: insufficient allowance");
        vm.prank(user);
        executor.enter(p, permit);
    }
}
```

- [ ] **Step 2: Run to verify failure**

Run: `cd contracts && forge test --match-contract PermitTest`
Expected: `test_enter_withMusdPermitNeedsNoApproval` and `test_exit_withLpPermit` FAIL with `ERC20: insufficient allowance`; the other three pass.

- [ ] **Step 3: Replace `contracts/src/MezoRouteExecutor.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IMezoRouteExecutor} from "./interfaces/IMezoRouteExecutor.sol";
import {ITigrisRouter} from "./interfaces/external/ITigrisRouter.sol";
import {IBorrowerOperationsSignatures} from "./interfaces/external/IBorrowerOperationsSignatures.sol";

/// @title MezoRouteExecutor
/// @notice Non-custodial, fixed-route executor for the Mezo MUSD/BTC volatile pool.
/// @dev Every amount it moves or reports is a delta measured inside the current call,
///      so balances held before a call can never be paid out or credited to a caller.
contract MezoRouteExecutor is IMezoRouteExecutor, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_FEE_BPS = 50;
    uint256 private constant BPS = 10_000;

    IERC20 public immutable musd;
    IERC20 public immutable btc;
    IERC20 public immutable pool;
    ITigrisRouter public immutable router;
    address public immutable factory;
    IBorrowerOperationsSignatures public immutable borrowerOperationsSignatures;
    uint256 public immutable feeBps;
    address public immutable feeRecipient;

    struct Balances {
        uint256 musd;
        uint256 btc;
        uint256 lp;
    }

    constructor(
        address musd_,
        address btc_,
        address router_,
        address factory_,
        address pool_,
        address borrowerOperationsSignatures_,
        uint256 feeBps_,
        address feeRecipient_
    ) {
        if (
            musd_ == address(0) || btc_ == address(0) || router_ == address(0) || factory_ == address(0)
                || pool_ == address(0) || borrowerOperationsSignatures_ == address(0) || feeRecipient_ == address(0)
        ) revert ZeroAddress();
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        if (ITigrisRouter(router_).poolFor(musd_, btc_, false, factory_) != pool_) revert PoolMismatch();

        musd = IERC20(musd_);
        btc = IERC20(btc_);
        pool = IERC20(pool_);
        router = ITigrisRouter(router_);
        factory = factory_;
        borrowerOperationsSignatures = IBorrowerOperationsSignatures(borrowerOperationsSignatures_);
        feeBps = feeBps_;
        feeRecipient = feeRecipient_;
    }

    /// @inheritdoc IMezoRouteExecutor
    function enter(EnterParams calldata p, Permit calldata musdPermit)
        external
        nonReentrant
        returns (uint256 liquidityOut)
    {
        _validateEnter(p);
        return _enter(p, musdPermit, 0);
    }

    /// @inheritdoc IMezoRouteExecutor
    function exit(ExitParams calldata p, Permit calldata lpPermit) external nonReentrant returns (uint256 musdOut) {
        if (p.liquidityIn == 0) revert ZeroAmount();
        if (p.recipient == address(0)) revert ZeroAddress();
        if (block.timestamp > p.deadline) revert Expired();

        Balances memory start = _snapshot();

        _tryPermit(address(pool), lpPermit);
        pool.safeTransferFrom(msg.sender, address(this), p.liquidityIn);

        pool.forceApprove(address(router), p.liquidityIn);
        router.removeLiquidity(
            address(musd),
            address(btc),
            false,
            p.liquidityIn,
            p.minMusdRemoved,
            p.minBtcRemoved,
            address(this),
            p.deadline
        );
        pool.forceApprove(address(router), 0);

        uint256 musdRemoved = _delta(musd, start.musd);
        uint256 btcRemoved = _delta(btc, start.btc);
        if (musdRemoved < p.minMusdRemoved || btcRemoved < p.minBtcRemoved) revert InsufficientLiquidityOutput();

        uint256 musdFromSwap;
        if (btcRemoved > 0) {
            btc.forceApprove(address(router), btcRemoved);
            router.swapExactTokensForTokens(
                btcRemoved, p.minMusdFromSwap, _route(address(btc), address(musd)), address(this), p.deadline
            );
            btc.forceApprove(address(router), 0);
            musdFromSwap = _delta(musd, start.musd) - musdRemoved;
        }
        if (musdFromSwap < p.minMusdFromSwap) revert InsufficientSwapOutput();

        musdOut = _delta(musd, start.musd);
        if (musdOut < p.minMusdOut) revert InsufficientFinalOutput();
        musd.safeTransfer(p.recipient, musdOut);

        uint256 btcRefund = _delta(btc, start.btc);
        if (btcRefund > 0) btc.safeTransfer(p.recipient, btcRefund);

        _assertNoDecrease(start);

        emit Exited(msg.sender, p.recipient, p.liquidityIn, musdRemoved, btcRemoved, musdFromSwap, musdOut, btcRefund);
    }

    function _enter(EnterParams calldata p, Permit calldata musdPermit, uint256 musdBorrowed)
        private
        returns (uint256 liquidityOut)
    {
        Balances memory start = _snapshot();

        _tryPermit(address(musd), musdPermit);
        musd.safeTransferFrom(msg.sender, address(this), p.musdIn);

        uint256 fee = (p.musdIn * feeBps) / BPS;
        if (fee > 0) musd.safeTransfer(feeRecipient, fee);
        if (p.musdToSwap == 0 || p.musdToSwap >= p.musdIn - fee) revert InvalidSwapAmount();

        musd.forceApprove(address(router), p.musdToSwap);
        router.swapExactTokensForTokens(
            p.musdToSwap, p.minBtcFromSwap, _route(address(musd), address(btc)), address(this), p.deadline
        );
        musd.forceApprove(address(router), 0);

        uint256 btcFromSwap = _delta(btc, start.btc);
        if (btcFromSwap < p.minBtcFromSwap) revert InsufficientSwapOutput();

        uint256 musdForLiquidity = _delta(musd, start.musd);
        musd.forceApprove(address(router), musdForLiquidity);
        btc.forceApprove(address(router), btcFromSwap);
        uint256 musdAdded;
        uint256 btcAdded;
        (musdAdded, btcAdded, liquidityOut) = router.addLiquidity(
            address(musd),
            address(btc),
            false,
            musdForLiquidity,
            btcFromSwap,
            p.minMusdAdded,
            p.minBtcAdded,
            p.recipient,
            p.deadline
        );
        musd.forceApprove(address(router), 0);
        btc.forceApprove(address(router), 0);

        if (musdAdded < p.minMusdAdded || btcAdded < p.minBtcAdded || liquidityOut < p.minLpOut) {
            revert InsufficientLiquidityOutput();
        }

        uint256 musdRefund = _delta(musd, start.musd);
        uint256 btcRefund = _delta(btc, start.btc);
        if (musdRefund > 0) musd.safeTransfer(p.recipient, musdRefund);
        if (btcRefund > 0) btc.safeTransfer(p.recipient, btcRefund);

        _assertNoDecrease(start);

        emit Entered(
            msg.sender,
            p.recipient,
            musdBorrowed,
            p.musdIn,
            fee,
            p.musdToSwap,
            btcFromSwap,
            musdAdded,
            btcAdded,
            liquidityOut,
            musdRefund,
            btcRefund
        );
    }

    function _validateEnter(EnterParams calldata p) private view {
        if (p.musdIn == 0) revert ZeroAmount();
        if (p.recipient == address(0)) revert ZeroAddress();
        if (block.timestamp > p.deadline) revert Expired();
    }

    /// @dev A front-run permit consumes the nonce and makes this call revert; the allowance it
    ///      set is still in place, so the failure is ignored and transferFrom decides.
    function _tryPermit(address token, Permit calldata permit_) private {
        if (permit_.value == 0) return;
        try IERC20Permit(token)
            .permit(msg.sender, address(this), permit_.value, permit_.deadline, permit_.v, permit_.r, permit_.s) {}
            catch {}
    }

    function _route(address from, address to) private view returns (ITigrisRouter.Route[] memory routes) {
        routes = new ITigrisRouter.Route[](1);
        routes[0] = ITigrisRouter.Route({from: from, to: to, stable: false, factory: factory});
    }

    function _snapshot() private view returns (Balances memory b) {
        b.musd = musd.balanceOf(address(this));
        b.btc = btc.balanceOf(address(this));
        b.lp = pool.balanceOf(address(this));
    }

    function _delta(IERC20 token, uint256 startBalance) private view returns (uint256) {
        uint256 current = token.balanceOf(address(this));
        if (current < startBalance) revert UnexpectedBalanceDecrease();
        return current - startBalance;
    }

    function _assertNoDecrease(Balances memory start) private view {
        if (
            musd.balanceOf(address(this)) < start.musd || btc.balanceOf(address(this)) < start.btc
                || pool.balanceOf(address(this)) < start.lp
        ) revert UnexpectedBalanceDecrease();
    }
}
```

- [ ] **Step 4: Run to verify all pass**

Run: `cd contracts && forge test`
Expected: `PermitTest` 5 passed; all earlier suites still pass.

- [ ] **Step 5: Format and commit**

```bash
cd contracts && forge fmt && forge fmt --check && cd ..
git add contracts
git commit -m "feat(contracts): accept EIP-2612 permits for MUSD and LP

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `borrowAndEnter` (borrow → LP in one transaction)

**Files:**
- Modify: `contracts/src/interfaces/IMezoRouteExecutor.sol` (full replacement below)
- Modify: `contracts/src/MezoRouteExecutor.sol` (full replacement below)
- Test: `contracts/test/BorrowAndEnter.t.sol`

**Interfaces:**
- Consumes: Task 4 executor; `MockBorrowerOperationsSignatures` from Task 1.
- Produces: `IMezoRouteExecutor.Borrow{amount,upperHint,lowerHint,signature,deadline}`, errors `NotBorrower`, `BorrowAmountMismatch`, `borrowAndEnter(Borrow,Permit,EnterParams) returns (uint256 liquidityOut)`. `Entered.musdBorrowed` equals `Borrow.amount`.

- [ ] **Step 1: Write the failing tests `contracts/test/BorrowAndEnter.t.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Vm} from "forge-std/Vm.sol";
import {TigrisHarness} from "./harness/TigrisHarness.sol";
import {IMezoRouteExecutor} from "../src/interfaces/IMezoRouteExecutor.sol";

contract BorrowAndEnterTest is TigrisHarness {
    bytes internal constant SIG = hex"0badc0de";

    function _borrow(uint256 amount) internal view returns (IMezoRouteExecutor.Borrow memory) {
        return IMezoRouteExecutor.Borrow({
            amount: amount,
            upperHint: address(0),
            lowerHint: address(0),
            signature: SIG,
            deadline: block.timestamp + 600
        });
    }

    function setUp() public override {
        super.setUp();
        vm.prank(user);
        musd.approve(address(executor), type(uint256).max);
    }

    function test_borrowAndEnter_borrowsToCallerThenDeposits() public {
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        vm.prank(user);
        uint256 lp = executor.borrowAndEnter(_borrow(1_000e18), _noPermit(), p);

        assertGt(lp, 0);
        assertEq(IERC20(pool).balanceOf(user), lp);
        assertEq(bos.lastBorrower(), user);
        assertEq(bos.lastRecipient(), user); // never the executor
        assertEq(musd.balanceOf(address(executor)), 0);
    }

    function test_borrowAndEnter_revertsWhenRecipientIsNotCaller() public {
        address mallory = makeAddr("mallory");
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, mallory);
        vm.expectRevert(IMezoRouteExecutor.NotBorrower.selector);
        vm.prank(user);
        executor.borrowAndEnter(_borrow(1_000e18), _noPermit(), p);
    }

    function test_borrowAndEnter_revertsOnAmountMismatch() public {
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        vm.expectRevert(IMezoRouteExecutor.BorrowAmountMismatch.selector);
        vm.prank(user);
        executor.borrowAndEnter(_borrow(999e18), _noPermit(), p);
    }

    function test_borrowAndEnter_frontRunLeavesMusdWithUser() public {
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        IMezoRouteExecutor.Borrow memory b = _borrow(1_000e18);

        // Attacker replays the signature straight to Mezo with the signed recipient (the user).
        bos.withdrawMUSDWithSignature(b.amount, address(0), address(0), user, user, b.signature, b.deadline);

        vm.expectRevert("BorrowerOperationsSignatures: Invalid signature");
        vm.prank(user);
        executor.borrowAndEnter(b, _noPermit(), p);

        assertEq(musd.balanceOf(user), 1_000e18);
        assertEq(musd.balanceOf(address(executor)), 0);
    }

    function test_borrowAndEnter_emitsBorrowedAmount() public {
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        vm.recordLogs();
        vm.prank(user);
        executor.borrowAndEnter(_borrow(1_000e18), _noPermit(), p);
        Vm.Log[] memory logs = vm.getRecordedLogs(); // consumes the recorded logs
        Vm.Log memory entered = logs[logs.length - 1];
        assertEq(entered.topics[0], IMezoRouteExecutor.Entered.selector);
        (uint256 musdBorrowed) = abi.decode(entered.data, (uint256));
        assertEq(musdBorrowed, 1_000e18);
    }
}
```

- [ ] **Step 2: Run to verify failure**

Run: `cd contracts && forge test --match-contract BorrowAndEnterTest`
Expected: compilation error — `IMezoRouteExecutor.Borrow` / `borrowAndEnter` not found.

- [ ] **Step 3: Replace `contracts/src/interfaces/IMezoRouteExecutor.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IMezoRouteExecutor {
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
    error Expired();
    error NotBorrower();
    error BorrowAmountMismatch();
    error FeeTooHigh();
    error PoolMismatch();
    error InvalidSwapAmount();
    error InsufficientSwapOutput();
    error InsufficientLiquidityOutput();
    error InsufficientFinalOutput();
    error UnexpectedBalanceDecrease();

    function enter(EnterParams calldata p, Permit calldata musdPermit) external returns (uint256 liquidityOut);

    function borrowAndEnter(Borrow calldata b, Permit calldata musdPermit, EnterParams calldata p)
        external
        returns (uint256 liquidityOut);

    function exit(ExitParams calldata p, Permit calldata lpPermit) external returns (uint256 musdOut);
}
```

- [ ] **Step 4: Replace `contracts/src/MezoRouteExecutor.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {IMezoRouteExecutor} from "./interfaces/IMezoRouteExecutor.sol";
import {ITigrisRouter} from "./interfaces/external/ITigrisRouter.sol";
import {IBorrowerOperationsSignatures} from "./interfaces/external/IBorrowerOperationsSignatures.sol";

/// @title MezoRouteExecutor
/// @notice Non-custodial, fixed-route executor for the Mezo MUSD/BTC volatile pool.
/// @dev Every amount it moves or reports is a delta measured inside the current call,
///      so balances held before a call can never be paid out or credited to a caller.
contract MezoRouteExecutor is IMezoRouteExecutor, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_FEE_BPS = 50;
    uint256 private constant BPS = 10_000;

    IERC20 public immutable musd;
    IERC20 public immutable btc;
    IERC20 public immutable pool;
    ITigrisRouter public immutable router;
    address public immutable factory;
    IBorrowerOperationsSignatures public immutable borrowerOperationsSignatures;
    uint256 public immutable feeBps;
    address public immutable feeRecipient;

    struct Balances {
        uint256 musd;
        uint256 btc;
        uint256 lp;
    }

    constructor(
        address musd_,
        address btc_,
        address router_,
        address factory_,
        address pool_,
        address borrowerOperationsSignatures_,
        uint256 feeBps_,
        address feeRecipient_
    ) {
        if (
            musd_ == address(0) || btc_ == address(0) || router_ == address(0) || factory_ == address(0)
                || pool_ == address(0) || borrowerOperationsSignatures_ == address(0) || feeRecipient_ == address(0)
        ) revert ZeroAddress();
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        if (ITigrisRouter(router_).poolFor(musd_, btc_, false, factory_) != pool_) revert PoolMismatch();

        musd = IERC20(musd_);
        btc = IERC20(btc_);
        pool = IERC20(pool_);
        router = ITigrisRouter(router_);
        factory = factory_;
        borrowerOperationsSignatures = IBorrowerOperationsSignatures(borrowerOperationsSignatures_);
        feeBps = feeBps_;
        feeRecipient = feeRecipient_;
    }

    /// @inheritdoc IMezoRouteExecutor
    function enter(EnterParams calldata p, Permit calldata musdPermit)
        external
        nonReentrant
        returns (uint256 liquidityOut)
    {
        _validateEnter(p);
        return _enter(p, musdPermit, 0);
    }

    /// @inheritdoc IMezoRouteExecutor
    function borrowAndEnter(Borrow calldata b, Permit calldata musdPermit, EnterParams calldata p)
        external
        nonReentrant
        returns (uint256 liquidityOut)
    {
        _validateEnter(p);
        if (p.recipient != msg.sender) revert NotBorrower();
        if (p.musdIn != b.amount) revert BorrowAmountMismatch();

        // Borrower and recipient are both the caller: a front-run of this signature can only
        // deliver the borrowed MUSD to the caller's own wallet.
        borrowerOperationsSignatures.withdrawMUSDWithSignature(
            b.amount, b.upperHint, b.lowerHint, msg.sender, msg.sender, b.signature, b.deadline
        );
        return _enter(p, musdPermit, b.amount);
    }

    /// @inheritdoc IMezoRouteExecutor
    function exit(ExitParams calldata p, Permit calldata lpPermit) external nonReentrant returns (uint256 musdOut) {
        if (p.liquidityIn == 0) revert ZeroAmount();
        if (p.recipient == address(0)) revert ZeroAddress();
        if (block.timestamp > p.deadline) revert Expired();

        Balances memory start = _snapshot();

        _tryPermit(address(pool), lpPermit);
        pool.safeTransferFrom(msg.sender, address(this), p.liquidityIn);

        pool.forceApprove(address(router), p.liquidityIn);
        router.removeLiquidity(
            address(musd),
            address(btc),
            false,
            p.liquidityIn,
            p.minMusdRemoved,
            p.minBtcRemoved,
            address(this),
            p.deadline
        );
        pool.forceApprove(address(router), 0);

        uint256 musdRemoved = _delta(musd, start.musd);
        uint256 btcRemoved = _delta(btc, start.btc);
        if (musdRemoved < p.minMusdRemoved || btcRemoved < p.minBtcRemoved) revert InsufficientLiquidityOutput();

        uint256 musdFromSwap;
        if (btcRemoved > 0) {
            btc.forceApprove(address(router), btcRemoved);
            router.swapExactTokensForTokens(
                btcRemoved, p.minMusdFromSwap, _route(address(btc), address(musd)), address(this), p.deadline
            );
            btc.forceApprove(address(router), 0);
            musdFromSwap = _delta(musd, start.musd) - musdRemoved;
        }
        if (musdFromSwap < p.minMusdFromSwap) revert InsufficientSwapOutput();

        musdOut = _delta(musd, start.musd);
        if (musdOut < p.minMusdOut) revert InsufficientFinalOutput();
        musd.safeTransfer(p.recipient, musdOut);

        uint256 btcRefund = _delta(btc, start.btc);
        if (btcRefund > 0) btc.safeTransfer(p.recipient, btcRefund);

        _assertNoDecrease(start);

        emit Exited(msg.sender, p.recipient, p.liquidityIn, musdRemoved, btcRemoved, musdFromSwap, musdOut, btcRefund);
    }

    function _enter(EnterParams calldata p, Permit calldata musdPermit, uint256 musdBorrowed)
        private
        returns (uint256 liquidityOut)
    {
        Balances memory start = _snapshot();

        _tryPermit(address(musd), musdPermit);
        musd.safeTransferFrom(msg.sender, address(this), p.musdIn);

        uint256 fee = (p.musdIn * feeBps) / BPS;
        if (fee > 0) musd.safeTransfer(feeRecipient, fee);
        if (p.musdToSwap == 0 || p.musdToSwap >= p.musdIn - fee) revert InvalidSwapAmount();

        musd.forceApprove(address(router), p.musdToSwap);
        router.swapExactTokensForTokens(
            p.musdToSwap, p.minBtcFromSwap, _route(address(musd), address(btc)), address(this), p.deadline
        );
        musd.forceApprove(address(router), 0);

        uint256 btcFromSwap = _delta(btc, start.btc);
        if (btcFromSwap < p.minBtcFromSwap) revert InsufficientSwapOutput();

        uint256 musdForLiquidity = _delta(musd, start.musd);
        musd.forceApprove(address(router), musdForLiquidity);
        btc.forceApprove(address(router), btcFromSwap);
        uint256 musdAdded;
        uint256 btcAdded;
        (musdAdded, btcAdded, liquidityOut) = router.addLiquidity(
            address(musd),
            address(btc),
            false,
            musdForLiquidity,
            btcFromSwap,
            p.minMusdAdded,
            p.minBtcAdded,
            p.recipient,
            p.deadline
        );
        musd.forceApprove(address(router), 0);
        btc.forceApprove(address(router), 0);

        if (musdAdded < p.minMusdAdded || btcAdded < p.minBtcAdded || liquidityOut < p.minLpOut) {
            revert InsufficientLiquidityOutput();
        }

        uint256 musdRefund = _delta(musd, start.musd);
        uint256 btcRefund = _delta(btc, start.btc);
        if (musdRefund > 0) musd.safeTransfer(p.recipient, musdRefund);
        if (btcRefund > 0) btc.safeTransfer(p.recipient, btcRefund);

        _assertNoDecrease(start);

        emit Entered(
            msg.sender,
            p.recipient,
            musdBorrowed,
            p.musdIn,
            fee,
            p.musdToSwap,
            btcFromSwap,
            musdAdded,
            btcAdded,
            liquidityOut,
            musdRefund,
            btcRefund
        );
    }

    function _validateEnter(EnterParams calldata p) private view {
        if (p.musdIn == 0) revert ZeroAmount();
        if (p.recipient == address(0)) revert ZeroAddress();
        if (block.timestamp > p.deadline) revert Expired();
    }

    /// @dev A front-run permit consumes the nonce and makes this call revert; the allowance it
    ///      set is still in place, so the failure is ignored and transferFrom decides.
    function _tryPermit(address token, Permit calldata permit_) private {
        if (permit_.value == 0) return;
        try IERC20Permit(token)
            .permit(msg.sender, address(this), permit_.value, permit_.deadline, permit_.v, permit_.r, permit_.s) {}
            catch {}
    }

    function _route(address from, address to) private view returns (ITigrisRouter.Route[] memory routes) {
        routes = new ITigrisRouter.Route[](1);
        routes[0] = ITigrisRouter.Route({from: from, to: to, stable: false, factory: factory});
    }

    function _snapshot() private view returns (Balances memory b) {
        b.musd = musd.balanceOf(address(this));
        b.btc = btc.balanceOf(address(this));
        b.lp = pool.balanceOf(address(this));
    }

    function _delta(IERC20 token, uint256 startBalance) private view returns (uint256) {
        uint256 current = token.balanceOf(address(this));
        if (current < startBalance) revert UnexpectedBalanceDecrease();
        return current - startBalance;
    }

    function _assertNoDecrease(Balances memory start) private view {
        if (
            musd.balanceOf(address(this)) < start.musd || btc.balanceOf(address(this)) < start.btc
                || pool.balanceOf(address(this)) < start.lp
        ) revert UnexpectedBalanceDecrease();
    }
}
```

- [ ] **Step 5: Run to verify all pass**

Run: `cd contracts && forge test`
Expected: `BorrowAndEnterTest` 5 passed; all earlier suites still pass.

- [ ] **Step 6: Format and commit**

```bash
cd contracts && forge fmt && forge fmt --check && cd ..
git add contracts
git commit -m "feat(contracts): add borrowAndEnter with caller-only borrow recipient

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Reentrancy and invariant tests

These verify properties the code already has, so they are expected to pass on first run. If any fails, stop and fix the executor before continuing — do not weaken the test.

**Files:**
- Create: `contracts/test/mocks/ReentrantMUSD.sol`
- Test: `contracts/test/Reentrancy.t.sol`
- Test: `contracts/test/invariant/ExecutorHandler.sol`, `contracts/test/invariant/Executor.invariant.t.sol`

**Interfaces:**
- Consumes: harness hook `_newMusd()` (Task 2), full executor (Task 5).
- Produces: nothing used by later tasks.

- [ ] **Step 1: Write `contracts/test/mocks/ReentrantMUSD.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MockERC20Permit} from "./MockERC20Permit.sol";

/// @dev MUSD stand-in that calls back into a target once during transferFrom.
contract ReentrantMUSD is MockERC20Permit {
    address public target;
    bytes public payload;

    constructor() MockERC20Permit("Mezo USD", "MUSD") {}

    function arm(address target_, bytes calldata payload_) external {
        target = target_;
        payload = payload_;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        address t = target;
        if (t != address(0)) {
            target = address(0);
            (bool ok, bytes memory ret) = t.call(payload);
            if (!ok) {
                assembly {
                    revert(add(ret, 32), mload(ret))
                }
            }
        }
        return super.transferFrom(from, to, amount);
    }
}
```

- [ ] **Step 2: Write `contracts/test/Reentrancy.t.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {TigrisHarness} from "./harness/TigrisHarness.sol";
import {IMezoRouteExecutor} from "../src/interfaces/IMezoRouteExecutor.sol";
import {MockERC20Permit} from "./mocks/MockERC20Permit.sol";
import {ReentrantMUSD} from "./mocks/ReentrantMUSD.sol";

contract ReentrancyTest is TigrisHarness {
    function _newMusd() internal override returns (MockERC20Permit) {
        return new ReentrantMUSD();
    }

    function test_enter_rejectsReentrantCall() public {
        _fund(user, 2_000e18);
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        ReentrantMUSD(address(musd)).arm(address(executor), abi.encodeCall(IMezoRouteExecutor.enter, (p, _noPermit())));

        vm.expectRevert("ReentrancyGuard: reentrant call");
        vm.prank(user);
        executor.enter(p, _noPermit());
    }
}
```

- [ ] **Step 3: Write `contracts/test/invariant/ExecutorHandler.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MezoRouteExecutor} from "../../src/MezoRouteExecutor.sol";
import {IMezoRouteExecutor} from "../../src/interfaces/IMezoRouteExecutor.sol";
import {ITigrisRouter} from "../../src/interfaces/external/ITigrisRouter.sol";
import {ITigrisQuoter} from "../harness/ITigrisQuoter.sol";
import {MockERC20Permit} from "../mocks/MockERC20Permit.sol";

/// @dev Drives random enters, exits and donations; tracks what was donated to the executor.
contract ExecutorHandler is Test {
    MezoRouteExecutor internal executor;
    MockERC20Permit internal musd;
    MockERC20Permit internal btc;
    IERC20 internal pool;
    address internal router;
    address internal factory;
    address[] internal actors;

    uint256 public donatedMusd;
    uint256 public donatedBtc;
    uint256 public donatedLp;

    constructor(
        MezoRouteExecutor executor_,
        MockERC20Permit musd_,
        MockERC20Permit btc_,
        address router_,
        address factory_
    ) {
        executor = executor_;
        musd = musd_;
        btc = btc_;
        pool = IERC20(address(executor_.pool()));
        router = router_;
        factory = factory_;
        for (uint256 i; i < 3; ++i) {
            address a = makeAddr(string.concat("actor", vm.toString(i)));
            actors.push(a);
            vm.startPrank(a);
            musd.approve(address(executor), type(uint256).max);
            pool.approve(address(executor), type(uint256).max);
            vm.stopPrank();
        }
    }

    function enter(uint256 actorSeed, uint256 amount) external {
        address a = actors[actorSeed % actors.length];
        amount = bound(amount, 1e18, 20_000e18);
        musd.mint(a, amount);
        uint256 net = amount - (amount * executor.feeBps()) / 10_000;
        ITigrisRouter.Route[] memory routes = new ITigrisRouter.Route[](1);
        routes[0] = ITigrisRouter.Route(address(musd), address(btc), false, factory);
        uint256 btcOut = ITigrisQuoter(router).getAmountsOut(net / 2, routes)[1];
        IMezoRouteExecutor.EnterParams memory p = IMezoRouteExecutor.EnterParams({
            musdIn: amount,
            musdToSwap: net / 2,
            minBtcFromSwap: (btcOut * 99) / 100,
            minMusdAdded: 0,
            minBtcAdded: 0,
            minLpOut: 0,
            deadline: block.timestamp + 600,
            recipient: a
        });
        vm.prank(a);
        executor.enter(p, _noPermit());
    }

    function exit(uint256 actorSeed, uint256 fraction) external {
        address a = actors[actorSeed % actors.length];
        uint256 lp = pool.balanceOf(a);
        if (lp == 0) return;
        uint256 amount = (lp * bound(fraction, 1, 100)) / 100;
        if (amount == 0) return;
        IMezoRouteExecutor.ExitParams memory p = IMezoRouteExecutor.ExitParams({
            liquidityIn: amount,
            minMusdRemoved: 0,
            minBtcRemoved: 0,
            minMusdFromSwap: 0,
            minMusdOut: 0,
            deadline: block.timestamp + 600,
            recipient: a
        });
        vm.prank(a);
        executor.exit(p, _noPermit());
    }

    function donate(uint256 musdAmount, uint256 btcAmount, uint256 actorSeed, uint256 lpFraction) external {
        musdAmount = bound(musdAmount, 0, 1_000e18);
        btcAmount = bound(btcAmount, 0, 1e16);
        musd.mint(address(executor), musdAmount);
        btc.mint(address(executor), btcAmount);
        donatedMusd += musdAmount;
        donatedBtc += btcAmount;

        address a = actors[actorSeed % actors.length];
        uint256 lp = (pool.balanceOf(a) * bound(lpFraction, 0, 10)) / 100;
        if (lp > 0) {
            vm.prank(a);
            pool.transfer(address(executor), lp);
            donatedLp += lp;
        }
    }

    function _noPermit() internal pure returns (IMezoRouteExecutor.Permit memory) {
        return IMezoRouteExecutor.Permit({value: 0, deadline: 0, v: 0, r: bytes32(0), s: bytes32(0)});
    }
}
```

- [ ] **Step 4: Write `contracts/test/invariant/Executor.invariant.t.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TigrisHarness} from "../harness/TigrisHarness.sol";
import {ExecutorHandler} from "./ExecutorHandler.sol";

contract ExecutorInvariantTest is TigrisHarness {
    ExecutorHandler internal handler;

    function setUp() public override {
        super.setUp();
        handler = new ExecutorHandler(executor, musd, btc, address(router), address(factory));
        targetContract(address(handler));
    }

    /// Executor balances are exactly what was donated: nothing user-attributable stays behind
    /// and nothing donated is ever paid out.
    function invariant_executorHoldsOnlyDonations() public view {
        assertEq(musd.balanceOf(address(executor)), handler.donatedMusd());
        assertEq(btc.balanceOf(address(executor)), handler.donatedBtc());
        assertEq(IERC20(pool).balanceOf(address(executor)), handler.donatedLp());
    }

    function invariant_noLingeringAllowances() public view {
        assertEq(musd.allowance(address(executor), address(router)), 0);
        assertEq(btc.allowance(address(executor), address(router)), 0);
        assertEq(IERC20(pool).allowance(address(executor), address(router)), 0);
    }
}
```

- [ ] **Step 5: Run the full suite**

Run: `cd contracts && forge test`
Expected: 40 tests, 0 failed. The invariant lines read `(runs: 64, calls: 2048, reverts: 0)`; a non-zero `reverts` count means the handler is building bad params — fix the handler, not the invariant.

- [ ] **Step 6: Format and commit**

```bash
cd contracts && forge fmt && forge fmt --check && cd ..
git add contracts
git commit -m "test(contracts): add reentrancy and balance/allowance invariants

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Deploy script, testnet deployment, verification, and live smoke test

Steps 4–7 need the user's funded testnet key; the agent prepares commands and stops for the user to run them (`! <command>` in Claude Code).

**Files:**
- Create: `contracts/script/Deploy.s.sol`
- Create: `contracts/script/smoke-testnet.sh`
- Create: `contracts/README.md`
- Modify: `PRODUCT_SPEC.md` Section 11.1 (add deployed executor address)

**Interfaces:**
- Consumes: full executor.
- Produces: deployed testnet executor address (recorded in `contracts/README.md` and spec 11.1) — the frontend plan consumes it together with `contracts/out/MezoRouteExecutor.sol/MezoRouteExecutor.json` (ABI).

- [ ] **Step 1: Write `contracts/script/Deploy.s.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MezoRouteExecutor} from "../src/MezoRouteExecutor.sol";

/// @notice Deploys MezoRouteExecutor with the fixed Mezo addresses for the current chain.
/// Env: FEE_BPS (e.g. 10), FEE_RECIPIENT (address).
contract Deploy is Script {
    struct MezoAddresses {
        address musd;
        address btc;
        address router;
        address factory;
        address pool;
        address borrowerOperationsSignatures;
    }

    function addressesFor(uint256 chainId) public pure returns (MezoAddresses memory) {
        if (chainId == 31611) {
            return MezoAddresses({
                musd: 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503,
                btc: 0x7b7C000000000000000000000000000000000000,
                router: 0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9,
                factory: 0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A,
                pool: 0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9,
                borrowerOperationsSignatures: 0xD757e3646AF370b15f32EB557F0F8380Df7D639e
            });
        }
        if (chainId == 31612) {
            return MezoAddresses({
                musd: 0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186,
                btc: 0x7b7C000000000000000000000000000000000000,
                router: 0x16A76d3cd3C1e3CE843C6680d6B37E9116b5C706,
                factory: 0x83FE469C636C4081b87bA5b3Ae9991c6Ed104248,
                pool: 0x52e604c44417233b6CcEDDDc0d640A405Caacefb,
                borrowerOperationsSignatures: 0xB57ab578BF20b3e318f3EFAA587C51DBccE5df7a
            });
        }
        revert("Deploy: unsupported chain");
    }

    function run() external returns (MezoRouteExecutor executor) {
        MezoAddresses memory a = addressesFor(block.chainid);
        uint256 feeBps = vm.envUint("FEE_BPS");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");

        vm.startBroadcast();
        executor = new MezoRouteExecutor(
            a.musd, a.btc, a.router, a.factory, a.pool, a.borrowerOperationsSignatures, feeBps, feeRecipient
        );
        vm.stopBroadcast();

        console2.log("MezoRouteExecutor", address(executor));
    }
}
```

- [ ] **Step 2: Dry-run against testnet and mainnet (no broadcast)**

```bash
cd contracts
FEE_BPS=10 FEE_RECIPIENT=0x000000000000000000000000000000000000dEaD \
  forge script script/Deploy.s.sol --rpc-url mezo_testnet --sender 0x000000000000000000000000000000000000bEEF
FEE_BPS=10 FEE_RECIPIENT=0x000000000000000000000000000000000000dEaD \
  forge script script/Deploy.s.sol --rpc-url mezo_mainnet --sender 0x000000000000000000000000000000000000bEEF
```

Expected: both print `Script ran successfully.` and a `MezoRouteExecutor` address. This proves the constructor's `poolFor` check matches the real pool on each chain.

- [ ] **Step 3: Write `contracts/script/smoke-testnet.sh` and make it executable**

```bash
#!/usr/bin/env bash
# Live Mezo testnet smoke test for a deployed MezoRouteExecutor.
# Mezo's BTC token is backed by a chain precompile, so this cannot run on a local fork;
# every call goes to the real testnet through `cast`.
#
# Required env:
#   PRIVATE_KEY  key holding test BTC for gas and at least AMOUNT MUSD
#   EXECUTOR     deployed MezoRouteExecutor address
# Optional env:
#   AMOUNT       MUSD in wei (default 20 MUSD)
#   BORROW=1     also run borrowAndEnter (the key must own an open Trove with headroom)
set -euo pipefail

RPC=${RPC:-https://rpc.test.mezo.org}
EXPLORER=https://explorer.test.mezo.org/tx
MUSD=0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503
BTC=0x7b7C000000000000000000000000000000000000
ROUTER=0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9
FACTORY=0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A
POOL=0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9
BOS=0xD757e3646AF370b15f32EB557F0F8380Df7D639e
ZERO32=0x0000000000000000000000000000000000000000000000000000000000000000
NO_PERMIT="(0,0,0,$ZERO32,$ZERO32)"
ENTER_SIG="enter((uint256,uint256,uint256,uint256,uint256,uint256,uint256,address),(uint256,uint256,uint8,bytes32,bytes32))"
EXIT_SIG="exit((uint256,uint256,uint256,uint256,uint256,uint256,address),(uint256,uint256,uint8,bytes32,bytes32))"
BORROW_SIG="borrowAndEnter((uint256,address,address,bytes,uint256),(uint256,uint256,uint8,bytes32,bytes32),(uint256,uint256,uint256,uint256,uint256,uint256,uint256,address))"

: "${PRIVATE_KEY:?set PRIVATE_KEY}"
: "${EXECUTOR:?set EXECUTOR}"
AMOUNT=${AMOUNT:-20000000000000000000}
ME=$(cast wallet address "$PRIVATE_KEY")

calc() { python3 -c "print(int($1))"; }
first() { awk '{print $1}'; }
send() {
  local hash
  hash=$(cast send "$@" --private-key "$PRIVATE_KEY" --rpc-url "$RPC" --json | python3 -c "import json,sys; print(json.load(sys.stdin)['transactionHash'])")
  echo "  $EXPLORER/$hash" >&2
  echo "$hash"
}
quote_swap() { # from to amountIn -> amountOut
  cast call "$ROUTER" "getAmountsOut(uint256,(address,address,bool,address)[])(uint256[])" "$3" "[($1,$2,false,$FACTORY)]" --rpc-url "$RPC" \
    | python3 -c "import sys,re; print(re.findall(r'\d+', sys.stdin.read().split(',')[1])[0])"
}
enter_params() { # amount recipient -> tuple
  local fee net swap btc_out
  fee=$(cast call "$EXECUTOR" "feeBps()(uint256)" --rpc-url "$RPC" | first)
  net=$(calc "$1 - $1 * $fee // 10000")
  swap=$(calc "$net // 2")
  btc_out=$(quote_swap "$MUSD" "$BTC" "$swap")
  echo "($1,$swap,$(calc "$btc_out * 99 // 100"),0,0,0,$(( $(date +%s) + 600 )),$2)"
}

echo "== enter $AMOUNT MUSD as $ME"
send "$MUSD" "approve(address,uint256)" "$EXECUTOR" "$AMOUNT" >/dev/null
ENTER_TX=$(send "$EXECUTOR" "$ENTER_SIG" "$(enter_params "$AMOUNT" "$ME")" "$NO_PERMIT")
cast receipt "$ENTER_TX" --rpc-url "$RPC" | grep -E "^status" 

echo "== exit all LP"
LP=$(cast call "$POOL" "balanceOf(address)(uint256)" "$ME" --rpc-url "$RPC" | first)
read -r MUSD_R BTC_R < <(cast call "$ROUTER" "quoteRemoveLiquidity(address,address,bool,address,uint256)(uint256,uint256)" \
  "$MUSD" "$BTC" false "$FACTORY" "$LP" --rpc-url "$RPC" | first | paste -sd' ' -)
SWAP_OUT=$(quote_swap "$BTC" "$MUSD" "$BTC_R")
MIN_OUT=$(calc "($MUSD_R + $SWAP_OUT) * 99 // 100")
send "$POOL" "approve(address,uint256)" "$EXECUTOR" "$LP" >/dev/null
EXIT_TX=$(send "$EXECUTOR" "$EXIT_SIG" "($LP,0,0,0,$MIN_OUT,$(( $(date +%s) + 600 )),$ME)" "$NO_PERMIT")
cast receipt "$EXIT_TX" --rpc-url "$RPC" | grep -E "^status"

if [[ "${BORROW:-0}" == "1" ]]; then
  echo "== borrowAndEnter $AMOUNT MUSD"
  NONCE=$(cast call "$BOS" "getNonce(address)(uint256)" "$ME" --rpc-url "$RPC" | first)
  DEADLINE=$(( $(date +%s) + 600 ))
  TYPED=$(mktemp)
  cat > "$TYPED" <<JSON
{"types":{"EIP712Domain":[{"name":"name","type":"string"},{"name":"version","type":"string"},{"name":"chainId","type":"uint256"},{"name":"verifyingContract","type":"address"}],
"WithdrawMUSD":[{"name":"amount","type":"uint256"},{"name":"borrower","type":"address"},{"name":"recipient","type":"address"},{"name":"nonce","type":"uint256"},{"name":"deadline","type":"uint256"}]},
"primaryType":"WithdrawMUSD","domain":{"name":"BorrowerOperationsSignatures","version":"1","chainId":31611,"verifyingContract":"$BOS"},
"message":{"amount":"$AMOUNT","borrower":"$ME","recipient":"$ME","nonce":"$NONCE","deadline":"$DEADLINE"}}
JSON
  SIG=$(cast wallet sign --private-key "$PRIVATE_KEY" --data --from-file "$TYPED")
  rm -f "$TYPED"
  send "$MUSD" "approve(address,uint256)" "$EXECUTOR" "$AMOUNT" >/dev/null
  BORROW_TX=$(send "$EXECUTOR" "$BORROW_SIG" "($AMOUNT,0x0000000000000000000000000000000000000000,0x0000000000000000000000000000000000000000,$SIG,$DEADLINE)" "$NO_PERMIT" "$(enter_params "$AMOUNT" "$ME")")
  cast receipt "$BORROW_TX" --rpc-url "$RPC" | grep -E "^status"
fi

echo "== executor balances (must be unchanged by this run)"
echo "  MUSD $(cast call "$MUSD" "balanceOf(address)(uint256)" "$EXECUTOR" --rpc-url "$RPC" | first)"
echo "  BTC  $(cast call "$BTC" "balanceOf(address)(uint256)" "$EXECUTOR" --rpc-url "$RPC" | first)"
echo "  LP   $(cast call "$POOL" "balanceOf(address)(uint256)" "$EXECUTOR" --rpc-url "$RPC" | first)"
```

Run: `chmod +x contracts/script/smoke-testnet.sh && bash -n contracts/script/smoke-testnet.sh`
Expected: no output (syntax OK).

- [ ] **Step 4 (user): Deploy to Mezo testnet**

Prerequisite: a key with test BTC from `https://faucet.test.mezo.org`, and `FEE_RECIPIENT` chosen by the user.

```bash
cd contracts
FEE_BPS=10 FEE_RECIPIENT=<fee recipient> \
  forge script script/Deploy.s.sol --rpc-url mezo_testnet --broadcast --private-key $PRIVATE_KEY
```

Expected: `MezoRouteExecutor 0x…`. Record the address as `EXECUTOR`.

- [ ] **Step 5 (user): Verify source on the Mezo testnet explorer (Blockscout)**

```bash
cd contracts
forge verify-contract $EXECUTOR src/MezoRouteExecutor.sol:MezoRouteExecutor \
  --chain 31611 --verifier blockscout --verifier-url https://api.explorer.test.mezo.org/api \
  --constructor-args $(cast abi-encode "constructor(address,address,address,address,address,address,uint256,address)" \
    0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503 0x7b7C000000000000000000000000000000000000 \
    0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9 0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A \
    0xd16A5Df82120ED8D626a1a15232bFcE2366d6AA9 0xD757e3646AF370b15f32EB557F0F8380Df7D639e \
    10 <fee recipient>)
```

Expected: `Contract successfully verified`; the explorer page shows source.

- [ ] **Step 6 (user): Run the live smoke test**

Prerequisite: the key holds ≥ 20 MUSD (borrow or swap in `https://testnet.mezo.org`).

```bash
PRIVATE_KEY=$PRIVATE_KEY EXECUTOR=$EXECUTOR contracts/script/smoke-testnet.sh
```

Expected: two explorer links with `status 1 (success)`, and the three executor balances printed at the end equal their values before the run (0 on a fresh deployment).

If the key owns a Trove with headroom, also run:

```bash
BORROW=1 PRIVATE_KEY=$PRIVATE_KEY EXECUTOR=$EXECUTOR contracts/script/smoke-testnet.sh
```

Expected: a third `status 1 (success)`. Then check spec 11.4's open point: in the `borrowAndEnter` receipt, `Entered.musdBorrowed` equals `musdIn` (the user received exactly `amount`). If the borrow step reverts with `BorrowAmountMismatch` or a transfer error, stop and report — spec 11.4 then requires comparing against the measured MUSD delta.

- [ ] **Step 7: Write `contracts/README.md`**

```markdown
# MezoRoute contracts

`MezoRouteExecutor` — non-custodial, fixed-route executor for the Mezo MUSD/BTC volatile pool.
See `../PRODUCT_SPEC.md` Section 11 for the specification.

## Build and test

    forge build
    forge test

Tests run against the real Tigris Pool/PoolFactory/Router source (commit `0a3b5e8`) deployed
locally with mock MUSD/BTC. Mezo's BTC token is a chain precompile, so fork tests are not possible;
`script/smoke-testnet.sh` exercises the deployed contract on Mezo testnet instead.

## Deployments

| Network | Address | Fee |
|---|---|---|
| Mezo testnet (31611) | `<EXECUTOR>` | 10 bps |

## Limitations

- `borrowAndEnter` supports EOA signers only (MUSD verifies with `ECDSA.recover`).
- No gauge staking or MEZO rewards: no MEZO-paying gauge exists for this pool.
- Unaudited. Mainnet deployment (Wave 2) adds an immutable per-transaction cap.
```

Replace `<EXECUTOR>` with the deployed address.

- [ ] **Step 8: Record the address in `PRODUCT_SPEC.md` Section 11.1**

Add a row to the first table: `| MezoRouteExecutor | <EXECUTOR> | Wave 2 |`.

- [ ] **Step 9: Commit**

```bash
cd contracts && forge fmt --check && cd ..
git add contracts PRODUCT_SPEC.md
git commit -m "feat(contracts): deploy script, testnet smoke test, and deployment record

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Out of scope for this plan

- Frontend (spec T4–T7, T10, T11, T13–T16) — separate plan after Task 7.
- Remaining T0 research (Discord user check, step count, `provideToSP` allowance check).
- Wave 2: per-transaction cap and mainnet deployment (W2-1, W2-2).
