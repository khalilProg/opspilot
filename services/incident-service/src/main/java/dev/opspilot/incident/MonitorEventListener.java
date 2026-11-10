package dev.opspilot.incident;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.Channel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Declarables;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.context.annotation.Bean;
import org.springframework.stereotype.Component;

@Component
class MonitorEventListener {
    private static final Logger log = LoggerFactory.getLogger(MonitorEventListener.class);
    private static final String QUEUE = "incident.monitor-events";
    private static final String DEAD_LETTER_QUEUE = QUEUE + ".dlq";

    private final ObjectMapper json;
    private final IncidentEventStore incidents;

    MonitorEventListener(ObjectMapper json, IncidentEventStore incidents) {
        this.json = json;
        this.incidents = incidents;
    }

    @Bean
    static Declarables monitorEventTopology(TopicExchange exchange) {
        var queue = QueueBuilder.durable(QUEUE).quorum().singleActiveConsumer().deliveryLimit(5)
                .deadLetterExchange("").deadLetterRoutingKey(DEAD_LETTER_QUEUE).build();
        return new Declarables(QueueBuilder.durable(DEAD_LETTER_QUEUE).build(),
                queue, BindingBuilder.bind(queue).to(exchange).with("monitor.*"));
    }

    @RabbitListener(queues = QUEUE)
    void receive(Message message, Channel channel) throws IOException {
        var properties = message.getMessageProperties();
        long tag = properties.getDeliveryTag();
        MonitorEvent event;
        try {
            event = json.readValue(message.getBody(), MonitorEvent.class);
            if (event == null || !event.valid(properties.getReceivedRoutingKey(), properties.getMessageId())) {
                throw new IllegalArgumentException("Invalid monitor event");
            }
        } catch (IOException | IllegalArgumentException ex) {
            log.warn("Rejecting malformed monitor event");
            channel.basicReject(tag, false);
            return;
        }

        try {
            incidents.apply(event);
        } catch (RuntimeException ex) {
            log.error("Could not process monitor event {}", event.eventId(), ex);
            // Reject (rather than nack) increments the quorum queue delivery count.
            channel.basicReject(tag, true);
            return;
        }
        channel.basicAck(tag, false);
    }

    record MonitorEvent(UUID eventId, String type, int version, UUID monitorId, OffsetDateTime occurredAt,
            String reason) {
        boolean valid(String routingKey, String messageId) {
            return version == 1 && eventId != null && monitorId != null && occurredAt != null
                    && ("monitor.down".equals(type) || "monitor.recovered".equals(type))
                    && type.equals(routingKey) && eventId.toString().equals(messageId);
        }
    }
}
