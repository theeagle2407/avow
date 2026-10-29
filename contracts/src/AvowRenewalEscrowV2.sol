// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAvowDecisionReceiverV2 {
    function getRenewal(bytes32 subscriptionId)
        external
        view
        returns (
            address customer,
            address merchant,
            uint256 previousAmountMinor,
            uint256 proposedAmountMinor,
            uint64 renewalAt,
            uint64 approvedAt,
            uint256 approvedAmountMinor,
            bool cancelled,
            bytes32 policyId
        );

    function latestDecision(bytes32 subscriptionId)
        external
        view
        returns (uint8 decision, bytes32 code, bytes32 evidenceHash, uint64 evaluatedAt);
}

/// @title AvowRenewalEscrowV2
/// @notice Releases one test renewal payment only while a fresh EXECUTE decision
///         still matches the current customer state.
/// @dev Sepolia demonstration contract. Not audited or intended for production funds.
contract AvowRenewalEscrowV2 {
    uint8 private constant EXECUTE = 1;

    IAvowDecisionReceiverV2 public immutable receiver;
    bytes32 public immutable subscriptionId;
    address public immutable customer;
    address payable public immutable merchant;
    uint256 public immutable amount;
    uint64 public immutable maxDecisionAge;

    bool public funded;
    bool public released;

    error Unauthorized();
    error InvalidConfiguration();
    error AlreadyFunded();
    error IncorrectAmount(uint256 expected, uint256 received);
    error NotFunded();
    error AlreadyReleased();
    error SettlementNotAuthorized(
        uint8 decision,
        bool customerStateCurrent,
        bool decisionFresh
    );
    error TransferFailed();

    event Funded(address indexed customer, uint256 amount);
    event Released(
        address indexed merchant,
        uint256 amount,
        bytes32 indexed evidenceHash,
        uint64 evaluatedAt
    );

    constructor(
        address receiverAddress,
        bytes32 renewalSubscriptionId,
        address customerAddress,
        address payable merchantAddress,
        uint256 renewalAmount,
        uint64 decisionLifetime
    ) {
        if (
            receiverAddress == address(0) ||
            renewalSubscriptionId == bytes32(0) ||
            customerAddress == address(0) ||
            merchantAddress == address(0) ||
            renewalAmount == 0 ||
            decisionLifetime == 0
        ) revert InvalidConfiguration();

        receiver = IAvowDecisionReceiverV2(receiverAddress);
        subscriptionId = renewalSubscriptionId;
        customer = customerAddress;
        merchant = merchantAddress;
        amount = renewalAmount;
        maxDecisionAge = decisionLifetime;
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

        (
            uint8 decision,
            bool canSettle,
            ,
            bool customerStateCurrent,
            bool decisionFresh,
            bytes32 evidenceHash,
            uint64 evaluatedAt
        ) = authorizationStatus();

        if (!canSettle) {
            revert SettlementNotAuthorized(
                decision,
                customerStateCurrent,
                decisionFresh
            );
        }

        released = true;
        (bool success,) = merchant.call{value: amount}("");
        if (!success) revert TransferFailed();
        emit Released(merchant, amount, evidenceHash, evaluatedAt);
    }

    function authorizationStatus()
        public
        view
        returns (
            uint8 decision,
            bool canSettle,
            uint256 heldBalance,
            bool customerStateCurrent,
            bool decisionFresh,
            bytes32 evidenceHash,
            uint64 evaluatedAt
        )
    {
        (decision,, evidenceHash, evaluatedAt) =
            receiver.latestDecision(subscriptionId);

        (,,,,, uint64 approvedAt,, bool cancelled,) =
            receiver.getRenewal(subscriptionId);

        // A cancellation always invalidates settlement. A later approval update
        // also requires a new CRE evaluation before funds may move.
        customerStateCurrent = !cancelled && evaluatedAt >= approvedAt;

        // Future timestamps and expired authorizations both fail closed.
        decisionFresh =
            evaluatedAt != 0 &&
            evaluatedAt <= block.timestamp &&
            block.timestamp - evaluatedAt <= maxDecisionAge;

        canSettle =
            funded &&
            !released &&
            decision == EXECUTE &&
            customerStateCurrent &&
            decisionFresh;

        heldBalance = address(this).balance;
    }
}

