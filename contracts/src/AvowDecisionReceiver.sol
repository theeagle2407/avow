// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

interface IReceiver is IERC165 {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}

/// @title AvowDecisionReceiver
/// @notice Stores renewal authorizations and immutable CRE decision history.
/// @dev The configured CRE mock forwarder is the only caller allowed to submit reports.
contract AvowDecisionReceiver is IReceiver {
    enum Decision {
        NONE,
        EXECUTE,
        BLOCK
    }

    struct Renewal {
        address customer;
        address merchant;
        uint256 previousAmountMinor;
        uint256 proposedAmountMinor;
        uint64 renewalAt;
        uint64 approvedAt;
        uint256 approvedAmountMinor;
        bool cancelled;
        bytes32 policyId;
    }

    struct DecisionReceipt {
        Decision decision;
        bytes32 code;
        bytes32 evidenceHash;
        uint64 evaluatedAt;
    }

    address public immutable owner;
    address public immutable forwarder;

    mapping(bytes32 => Renewal) private s_renewals;
    mapping(bytes32 => DecisionReceipt[]) private s_decisions;
    mapping(bytes32 => bool) public consumedEvidence;

    error Unauthorized();
    error InvalidForwarder(address caller);
    error RenewalAlreadyExists(bytes32 subscriptionId);
    error RenewalNotFound(bytes32 subscriptionId);
    error InvalidRenewal();
    error InvalidReportSelector(bytes4 selector);
    error EvidenceAlreadyConsumed(bytes32 evidenceHash);

    event RenewalCreated(
        bytes32 indexed subscriptionId,
        address indexed customer,
        address indexed merchant,
        uint256 proposedAmountMinor,
        uint64 renewalAt,
        bytes32 policyId
    );
    event AmountApproved(bytes32 indexed subscriptionId, uint256 amountMinor, uint64 approvedAt);
    event RenewalCancelled(bytes32 indexed subscriptionId, uint64 cancelledAt);
    event DecisionRecorded(
        bytes32 indexed subscriptionId,
        uint256 indexed sequence,
        Decision decision,
        bytes32 code,
        bytes32 evidenceHash,
        uint64 evaluatedAt
    );

    constructor(address mockForwarder) {
        if (mockForwarder == address(0)) revert InvalidRenewal();
        owner = msg.sender;
        forwarder = mockForwarder;
    }

    function createRenewal(
        bytes32 subscriptionId,
        address customer,
        address merchant,
        uint256 previousAmountMinor,
        uint256 proposedAmountMinor,
        uint64 renewalAt,
        bytes32 policyId
    ) external {
        if (msg.sender != owner) revert Unauthorized();
        if (s_renewals[subscriptionId].customer != address(0)) {
            revert RenewalAlreadyExists(subscriptionId);
        }
        if (
            subscriptionId == bytes32(0) || customer == address(0) || merchant == address(0)
                || previousAmountMinor == 0 || proposedAmountMinor == 0 || renewalAt <= block.timestamp
                || policyId == bytes32(0)
        ) revert InvalidRenewal();

        s_renewals[subscriptionId] = Renewal({
            customer: customer,
            merchant: merchant,
            previousAmountMinor: previousAmountMinor,
            proposedAmountMinor: proposedAmountMinor,
            renewalAt: renewalAt,
            approvedAt: 0,
            approvedAmountMinor: 0,
            cancelled: false,
            policyId: policyId
        });

        emit RenewalCreated(
            subscriptionId,
            customer,
            merchant,
            proposedAmountMinor,
            renewalAt,
            policyId
        );
    }

    function approveAmount(bytes32 subscriptionId, uint256 amountMinor) external {
        Renewal storage renewal = _renewal(subscriptionId);
        if (msg.sender != renewal.customer) revert Unauthorized();
        if (renewal.cancelled || amountMinor != renewal.proposedAmountMinor) revert InvalidRenewal();
        renewal.approvedAmountMinor = amountMinor;
        renewal.approvedAt = uint64(block.timestamp);
        emit AmountApproved(subscriptionId, amountMinor, renewal.approvedAt);
    }

    function cancelRenewal(bytes32 subscriptionId) external {
        Renewal storage renewal = _renewal(subscriptionId);
        if (msg.sender != renewal.customer) revert Unauthorized();
        renewal.cancelled = true;
        emit RenewalCancelled(subscriptionId, uint64(block.timestamp));
    }

    function getRenewal(bytes32 subscriptionId) external view returns (Renewal memory) {
        Renewal memory renewal = s_renewals[subscriptionId];
        if (renewal.customer == address(0)) revert RenewalNotFound(subscriptionId);
        return renewal;
    }

    function decisionCount(bytes32 subscriptionId) external view returns (uint256) {
        return s_decisions[subscriptionId].length;
    }

    function decisionAt(bytes32 subscriptionId, uint256 index)
        external
        view
        returns (DecisionReceipt memory)
    {
        return s_decisions[subscriptionId][index];
    }

    function latestDecision(bytes32 subscriptionId)
        external
        view
        returns (DecisionReceipt memory)
    {
        uint256 length = s_decisions[subscriptionId].length;
        if (length == 0) return DecisionReceipt(Decision.NONE, bytes32(0), bytes32(0), 0);
        return s_decisions[subscriptionId][length - 1];
    }

    /// @inheritdoc IReceiver
    function onReport(bytes calldata, bytes calldata report) external override {
        if (msg.sender != forwarder) revert InvalidForwarder(msg.sender);
        if (report.length < 4) revert InvalidReportSelector(bytes4(0));

        bytes4 selector = bytes4(report[:4]);
        if (selector != this.recordDecision.selector) revert InvalidReportSelector(selector);

        (bool success, bytes memory reason) = address(this).call(report);
        if (!success) {
            assembly {
                revert(add(reason, 32), mload(reason))
            }
        }
    }

    /// @notice Called only through onReport after the trusted forwarder check.
    function recordDecision(
        bytes32 subscriptionId,
        bool execute,
        bytes32 code,
        bytes32 evidenceHash,
        uint64 evaluatedAt
    ) external {
        if (msg.sender != address(this)) revert Unauthorized();
        _renewal(subscriptionId);
        if (consumedEvidence[evidenceHash]) revert EvidenceAlreadyConsumed(evidenceHash);

        consumedEvidence[evidenceHash] = true;
        Decision decision = execute ? Decision.EXECUTE : Decision.BLOCK;
        s_decisions[subscriptionId].push(
            DecisionReceipt(decision, code, evidenceHash, evaluatedAt)
        );

        emit DecisionRecorded(
            subscriptionId,
            s_decisions[subscriptionId].length,
            decision,
            code,
            evidenceHash,
            evaluatedAt
        );
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    function _renewal(bytes32 subscriptionId) private view returns (Renewal storage renewal) {
        renewal = s_renewals[subscriptionId];
        if (renewal.customer == address(0)) revert RenewalNotFound(subscriptionId);
    }
}
