package com.sherlock.groundcontrol.service;

import com.sherlock.groundcontrol.dto.CommandLifecycleDTO;
import com.sherlock.groundcontrol.dto.DroneCommandDTO.CommandType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.lang.reflect.Field;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class CommandLifecycleServiceTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    private CommandLifecycleService service;

    @BeforeEach
    void setUp() throws Exception {
        service = new CommandLifecycleService(messagingTemplate);
        setField(service, "perDroneLimit", 20);
        setField(service, "ackTimeoutMs", 5000L);
    }

    @Test
    void createPendingPublishesToDroneTopic() {
        CommandLifecycleDTO created = service.createPending("MAVLINK-01", CommandType.RTH, "queued");

        assertEquals(CommandLifecycleDTO.CommandStatus.PENDING, created.getStatus());
        assertEquals("MAVLINK-01", created.getDroneId());
        verify(messagingTemplate).convertAndSend(eq("/topic/commands/MAVLINK-01"), any(CommandLifecycleDTO.class));
    }

    @Test
    void resolveCommandAckMarksTrackedCommandAsAcked() {
        CommandLifecycleDTO created = service.createPending("MAVLINK-01", CommandType.TAKEOFF, "queued");
        service.markSent(created.getCommandId(), "sent");
        service.registerAwaitingAck(created.getCommandId(), 22);

        CommandLifecycleDTO acked = service.resolveCommandAck("MAVLINK-01", 22, 0).orElseThrow();

        assertEquals(CommandLifecycleDTO.CommandStatus.ACKED, acked.getStatus());
        assertTrue(acked.getDetail().contains("ACCEPTED"));
    }

    @Test
    void expireTimedOutCommandsMovesSentCommandToTimeout() throws Exception {
        setField(service, "ackTimeoutMs", 1L);
        CommandLifecycleDTO created = service.createPending("MAVLINK-01", CommandType.RTH, "queued");
        service.markSent(created.getCommandId(), "sent");
        Thread.sleep(5L);

        service.expireTimedOutCommands();

        List<CommandLifecycleDTO> recent = service.getRecentCommands("MAVLINK-01", 20);
        assertEquals(CommandLifecycleDTO.CommandStatus.TIMEOUT, recent.get(0).getStatus());
    }

    @Test
    void historyIsTrimmedToConfiguredLimit() throws Exception {
        setField(service, "perDroneLimit", 2);
        service.createPending("MAVLINK-01", CommandType.RTH, "one");
        service.createPending("MAVLINK-01", CommandType.ARM, "two");
        service.createPending("MAVLINK-01", CommandType.DISARM, "three");

        List<CommandLifecycleDTO> recent = service.getRecentCommands("MAVLINK-01", 20);
        assertEquals(2, recent.size());
        assertEquals(CommandType.DISARM, recent.get(0).getCommandType());
        assertEquals(CommandType.ARM, recent.get(1).getCommandType());
        verify(messagingTemplate, atLeastOnce()).convertAndSend(eq("/topic/commands/MAVLINK-01"), any(CommandLifecycleDTO.class));
    }

    private static void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }
}
