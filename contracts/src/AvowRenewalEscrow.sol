// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAvowDecisionReceiver {
    function latestDecision(bytes32 subscriptionId)
        external
        view
        returns (uint8 decision, bytes32 code, bytes32 evidenceHash, uint64 evaluatedAt);
}

/// @title AvowRenewalEscrow
/// @notice Holds one test renewal payment and releases it only after an EXECUTE decision.
/// @dev Demonstration escrow for Sepolia. It is not a production payment processor.
contract AvowRenewalEscrow {
    uint8 private constant EXECUTE = 1;

    IAvowDecisionReceiver public immutable receiver;
    bytes32 public immutable subscriptionId;
    address public immutable customer;
    address payable public immutable merchant;
    uint256 public immutable amount;

    bool public funded;
    bool public released;

    error Unauthorized();
    error InvalidConfiguration();
    error AlreadyFunded();
    error IncorrectAmount(uint256 expected, uint256 received);
    error NotFunded();
    error AlreadyReleased();
    error SettlementNotAuthorized(uint8 decision);
    error TransferFailed();

    event Funded(address indexed customer, uint256 amount);
    event Released(address indexed merchant, uint256 amount, bytes32 indexed evidenceHash);

    constructor(
        address receiverAddress,
        bytes32 renewalSubscriptionId,
        address customerAddress,
        address payable merchantAddress,
        uint256 renewalAmount
    ) {
        if (
            receiverAddress == address(0) || renewalSubscriptionId == bytes32(0)
                || customerAddress == address(0) || merchantAddress == address(0)
                || renewalAmount == 0
        ) revert InvalidConfiguration();

        receiver = IAvowDecisionReceiver(receiverAddress);
        subscriptionId = renewalSubscriptionId;
        customer = customerAddress;
        merchant = merchantAddress;
        amount = renewalAmount;
    }

    function fund() external payable {
        if (msg.sender != customer) revert Unauthorized();
        if (funded) revert AlreadyFunded();
        if (msg.value != amount) revert IncorrectAmount(amount, msg.value);
        funded = true;
        emit Funded(msg.sender, msg.value);
    }

    function settle() external {
        if (!funded) revert NotFunded();
        if (released) revert AlreadyReleased();

        (uint8 decision,, bytes32 evidenceHash,) = receiver.latestDecision(subscriptionId);
        if (decision != EXECUTE) revert SettlementNotAuthorized(decision);

        released = true;
        (bool success,) = merchant.call{value: amount}("");
        if (!success) revert TransferFailed();
        emit Released(merchant, amount, evidenceHash);
    }

    function settlementStatus()
        external
        view
        returns (uint8 decision, bool canSettle, uint256 heldBalance)
    {
        (decision,,,) = receiver.latestDecision(subscriptionId);
        canSettle = funded && !released && decision == EXECUTE;
        heldBalance = address(this).balance;
    }
}
