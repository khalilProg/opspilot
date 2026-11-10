package dev.opspilot.monitor;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import org.springframework.amqp.core.MessageBuilder;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.context.annotation.Bean;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Component
class EventOutbox {
    static final String EXCHANGE = "opspilot.events";
    private final JdbcClient jdbc;
    private final RabbitTemplate rabbit;
    private final TransactionTemplate transactions;

    EventOutbox(JdbcClient jdbc, RabbitTemplate rabbit, PlatformTransactionManager transactionManager) {
        this.jdbc = jdbc;
        this.rabbit = rabbit;
        this.transactions = new TransactionTemplate(transactionManager);
    }

    @Bean
    static TopicExchange eventsExchange() {
        return new TopicExchange(EXCHANGE, true, false);
    }

    @Scheduled(fixedDelay = 2000)
    void publishPending() {
        for (int i = 0; i < 20; i++) {
            if (!Boolean.TRUE.equals(transactions.execute(transaction -> publishOne()))) {
                return;
            }
        }
    }

    private boolean publishOne() {
        var pending = jdbc.sql("""
                SELECT event_id, routing_key, payload::text
                FROM event_outbox WHERE published_at IS NULL
                ORDER BY sequence LIMIT 1 FOR UPDATE
                """)
                .query((rs, row) -> new Event(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3)))
                .optional();
        if (pending.isEmpty()) {
            return false;
        }
        Event event = pending.get();
        var correlation = new CorrelationData(event.id().toString());
        var message = MessageBuilder.withBody(event.payload().getBytes(StandardCharsets.UTF_8))
                .setContentType("application/json")
                .setDeliveryMode(MessageDeliveryMode.PERSISTENT)
                .setMessageId(event.id().toString())
                .build();
        rabbit.send(EXCHANGE, event.routingKey(), message, correlation);
        try {
            if (!correlation.getFuture().get(5, TimeUnit.SECONDS).isAck() || correlation.getReturned() != null) {
                throw new IllegalStateException("Event was not confirmed and routed: " + event.id());
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while publishing event " + event.id(), ex);
        } catch (ExecutionException | TimeoutException ex) {
            throw new IllegalStateException("Could not confirm event " + event.id(), ex);
        }
        jdbc.sql("UPDATE event_outbox SET published_at = CURRENT_TIMESTAMP WHERE event_id = ?")
                .param(event.id())
                .update();
        return true;
    }

    private record Event(UUID id, String routingKey, String payload) {
    }
}
