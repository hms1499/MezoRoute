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

    function test_enter_invalidPermitFallsBackToExistingAllowance() public {
        _fund(user, 1_000e18);
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        IMezoRouteExecutor.Permit memory permit = _signPermit(address(musd), 1_000e18);
        permit.s = bytes32(uint256(permit.s) ^ 1); // corrupt the signature

        vm.prank(user);
        assertGt(executor.enter(p, permit), 0);
    }

    function test_borrowAndEnter_withMusdPermitNeedsNoApproval() public {
        // Borrow & Deploy: one borrow signature plus one MUSD permit, no approval transaction.
        IMezoRouteExecutor.EnterParams memory p = _enterParams(1_000e18, user);
        IMezoRouteExecutor.Permit memory permit = _signPermit(address(musd), 1_000e18);
        IMezoRouteExecutor.Borrow memory b = IMezoRouteExecutor.Borrow({
            amount: 1_000e18,
            upperHint: address(0),
            lowerHint: address(0),
            signature: hex"0badc0de",
            deadline: block.timestamp + 600
        });

        vm.prank(user);
        uint256 lp = executor.borrowAndEnter(b, permit, p);

        assertEq(IERC20(pool).balanceOf(user), lp);
        assertEq(musd.allowance(user, address(executor)), 0);
    }
}
