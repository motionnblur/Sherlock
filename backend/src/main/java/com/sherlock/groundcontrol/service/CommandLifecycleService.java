package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.CommandLifecycleDTO;
import com.sherlock.groundcontrol.dto.CommandLifecycleDTO.CommandStatus;
import com.sherlock.groundcontrol.dto.DroneCommandDTO.CommandType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class CommandLifecycleService {

    private static final String COMMAND_TOPIC_PREFIX = "/topic/commands/";
    private static final int COMMAND_ACK_ACCEPTED = 0;
    private static final int COMMAND_ACK_IN_PROGRESS = 5;
    private static final int MAX_HISTORY_QUERY_LIMIT = 100;
    private static final long TIMEOUT_SCAN_INTERVAL_MS = 500L;

    private final SimpMessagingTemplate messagingTemplate;

    @Value("${app.command.lifecycle.per-drone-limit:20}")
    private int perDroneLimit;

    @Value("${app.command.lifecycle.ack-timeout-ms:5000}")
    private long ackTimeoutMs;

    private final Map<String, Deque<TrackedCommand>> historyByDrone = new ConcurrentHashMap<>();
    private final Map<String, TrackedCommand> trackedById = new ConcurrentHashMap<>();
    private final Map<AwaitingAckKey, Deque<String>> awaitingAckByKey = new ConcurrentHashMap<>();

    public synchronized CommandLifecycleDTO createPending(String droneId, CommandType commandType, String detail) {
        Instant now = Instant.now();
        TrackedCommand trackedCommand = new TrackedCommand(
                UUID.randomUUID().toString(),
                droneId,
                commandType,
                CommandStatus.PENDING,
                now,
                now,
                detail,
                null
        );

        trackedById.put(trackedCommand.commandId, trackedCommand);
        Deque<TrackedCommand> history = historyByDrone.computeIfAbsent(droneId, ignored -> new ArrayDeque<>());
        history.addFirst(trackedCommand);
        trimHistory(history);

        CommandLifecycleDTO snapshot = snapshot(trackedCommand);
        publish(snapshot);
        return snapshot;
    }

    public synchronized Optional<CommandLifecycleDTO> markSent(String commandId, String detail) {
        return transition(commandId, CommandStatus.SENT, detail);
    }

    public synchronized Optional<CommandLifecycleDTO> markAcked(String commandId, String detail) {
        return transition(commandId, CommandStatus.ACKED, detail);
    }

    public synchronized Optional<CommandLifecycleDTO> markFailed(String commandId, String detail) {
        return transition(commandId, CommandStatus.FAILED, detail);
    }

    public synchronized Optional<CommandLifecycleDTO> registerAwaitingAck(String commandId, int mavCommandId) {
        TrackedCommand tracked = trackedById.get(commandId);
        if (tracked == null || isTerminal(tracked.status)) {
            return Optional.empty();
        }

        tracked.awaitingMavCommandId = mavCommandId;
        AwaitingAckKey key = new AwaitingAckKey(tracked.droneId, mavCommandId);
        awaitingAckByKey.computeIfAbsent(key, ignored -> new ArrayDeque<>()).addLast(commandId);
        return Optional.of(snapshot(tracked));
    }

    public synchronized Optional<CommandLifecycleDTO> resolveCommandAck(String droneId, int mavCommandId, int ackResult) {
        AwaitingAckKey key = new AwaitingAckKey(droneId, mavCommandId);
        Deque<String> queue = awaitingAckByKey.get(key);
        if (queue == null) {
            return Optional.empty();
        }

        while (!queue.isEmpty()) {
            String commandId = queue.pollFirst();
            TrackedCommand tracked = trackedById.get(commandId);
            if (tracked == null || isTerminal(tracked.status)) {
                continue;
            }

            if (queue.isEmpty()) {
                awaitingAckByKey.remove(key);
            }

            CommandStatus nextStatus = isAckSuccess(ackResult) ? CommandStatus.ACKED : CommandStatus.REJECTED;
            return transitionInternal(tracked, nextStatus, formatAckDetail(ackResult), true);
        }

        awaitingAckByKey.remove(key);
        return Optional.empty();
    }

    public synchronized List<CommandLifecycleDTO> getRecentCommands(String droneId, int requestedLimit) {
        int limit = normalizeHistoryLimit(requestedLimit);
        Deque<TrackedCommand> history = historyByDrone.get(droneId);
        if (history == null || history.isEmpty()) {
            return List.of();
        }

        List<CommandLifecycleDTO> snapshots = new ArrayList<>(Math.min(limit, history.size()));
        int index = 0;
        for (TrackedCommand tracked : history) {
            if (index >= limit) {
                break;
            }
            snapshots.add(snapshot(tracked));
            index++;
        }
        return snapshots;
    }

    @Scheduled(fixedRate = TIMEOUT_SCAN_INTERVAL_MS)
    public synchronized void expireTimedOutCommands() {
        Instant now = Instant.now();
        Instant timeoutBoundary = now.minusMillis(Math.max(1L, ackTimeoutMs));
        for (TrackedCommand tracked : trackedById.values()) {
            if (isTerminal(tracked.status)) {
                continue;
            }
            if (tracked.updatedAt.isAfter(timeoutBoundary)) {
                continue;
            }
            transitionInternal(
                    tracked,
                    CommandStatus.TIMEOUT,
                    "ACK timeout after " + ackTimeoutMs + " ms",
                    true
            );
            log.warn("Command {} timed out for drone {}", tracked.commandId, tracked.droneId);
        }
    }

    private Optional<CommandLifecycleDTO> transition(String commandId, CommandStatus targetStatus, String detail) {
        TrackedCommand tracked = trackedById.get(commandId);
        if (tracked == null) {
            return Optional.empty();
        }
        return transitionInternal(tracked, targetStatus, detail, true);
    }

    private Optional<CommandLifecycleDTO> transitionInternal(
            TrackedCommand tracked,
            CommandStatus targetStatus,
            String detail,
            boolean shouldPublish
    ) {
        if (isTerminal(tracked.status)) {
            return Optional.of(snapshot(tracked));
        }

        tracked.status = targetStatus;
        tracked.updatedAt = Instant.now();
        if (detail != null && !detail.isBlank()) {
            tracked.detail = detail;
        }

        if (isTerminal(targetStatus)) {
            removeAwaitingIndex(tracked);
        }

        CommandLifecycleDTO snapshot = snapshot(tracked);
        if (shouldPublish) {
            publish(snapshot);
        }
        return Optional.of(snapshot);
    }

    private void trimHistory(Deque<TrackedCommand> history) {
        int historyLimit = normalizeHistoryLimit(perDroneLimit);
        while (history.size() > historyLimit) {
            TrackedCommand removed = history.removeLast();
            trackedById.remove(removed.commandId);
            removeAwaitingIndex(removed);
        }
    }

    private void removeAwaitingIndex(TrackedCommand tracked) {
        if (tracked.awaitingMavCommandId == null) {
            return;
        }
        AwaitingAckKey key = new AwaitingAckKey(tracked.droneId, tracked.awaitingMavCommandId);
        Deque<String> queuedIds = awaitingAckByKey.get(key);
        if (queuedIds == null) {
            tracked.awaitingMavCommandId = null;
            return;
        }
        queuedIds.remove(tracked.commandId);
        if (queuedIds.isEmpty()) {
            awaitingAckByKey.remove(key);
        }
        tracked.awaitingMavCommandId = null;
    }

    private CommandLifecycleDTO snapshot(TrackedCommand tracked) {
        return CommandLifecycleDTO.builder()
                .commandId(tracked.commandId)
                .droneId(tracked.droneId)
                .commandType(tracked.commandType)
                .status(tracked.status)
                .requestedAt(tracked.requestedAt)
                .updatedAt(tracked.updatedAt)
                .detail(tracked.detail)
                .build();
    }

    private void publish(CommandLifecycleDTO payload) {
        messagingTemplate.convertAndSend(COMMAND_TOPIC_PREFIX + payload.getDroneId(), payload);
    }

    private static boolean isTerminal(CommandStatus status) {
        return status == CommandStatus.ACKED
                || status == CommandStatus.REJECTED
                || status == CommandStatus.TIMEOUT
                || status == CommandStatus.FAILED;
    }

    private static boolean isAckSuccess(int ackResult) {
        return ackResult == COMMAND_ACK_ACCEPTED || ackResult == COMMAND_ACK_IN_PROGRESS;
    }

    private static String formatAckDetail(int ackResult) {
        return switch (ackResult) {
            case 0 -> "COMMAND_ACK ACCEPTED";
            case 1 -> "COMMAND_ACK TEMPORARILY_REJECTED";
            case 2 -> "COMMAND_ACK DENIED";
            case 3 -> "COMMAND_ACK UNSUPPORTED";
            case 4 -> "COMMAND_ACK FAILED";
            case 5 -> "COMMAND_ACK IN_PROGRESS";
            case 6 -> "COMMAND_ACK CANCELLED";
            default -> "COMMAND_ACK RESULT=" + ackResult;
        };
    }

    private static int normalizeHistoryLimit(int requestedLimit) {
        if (requestedLimit <= 0) {
            return 20;
        }
        return Math.min(requestedLimit, MAX_HISTORY_QUERY_LIMIT);
    }

    private record AwaitingAckKey(String droneId, int mavCommandId) {}

    private static final class TrackedCommand {
        private final String commandId;
        private final String droneId;
        private final CommandType commandType;
        private final Instant requestedAt;
        private CommandStatus status;
        private Instant updatedAt;
        private String detail;
        private Integer awaitingMavCommandId;

        private TrackedCommand(
                String commandId,
                String droneId,
                CommandType commandType,
                CommandStatus status,
                Instant requestedAt,
                Instant updatedAt,
                String detail,
                Integer awaitingMavCommandId
        ) {
            this.commandId = commandId;
            this.droneId = droneId;
            this.commandType = commandType;
            this.status = status;
            this.requestedAt = requestedAt;
            this.updatedAt = updatedAt;
            this.detail = detail;
            this.awaitingMavCommandId = awaitingMavCommandId;
        }
    }
}
