package main

import (
	"encoding/json"
	"errors"
	"log"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

const eventExchange = "opspilot.events"
const notificationQueue = "notification.incident-events"
const deadLetterQueue = notificationQueue + ".dlq"

var eventUUID = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

type incidentEvent struct {
	EventID    string    `json:"eventId"`
	Type       string    `json:"type"`
	Version    int       `json:"version"`
	MonitorID  string    `json:"monitorId"`
	IncidentID string    `json:"incidentId"`
	OccurredAt time.Time `json:"occurredAt"`
}

func parseEvent(body []byte, routingKey, messageID string) (incidentEvent, error) {
	var event incidentEvent
	if err := json.Unmarshal(body, &event); err != nil {
		return event, err
	}
	if event.Version != 1 || event.OccurredAt.IsZero() || !eventUUID.MatchString(event.EventID) ||
		!eventUUID.MatchString(event.MonitorID) || !eventUUID.MatchString(event.IncidentID) ||
		event.EventID != messageID || event.Type != routingKey ||
		(event.Type != "incident.opened" && event.Type != "incident.resolved") {
		return event, errors.New("invalid incident event")
	}
	return event, nil
}

// The notification record is the durable side effect and the deduplication marker.
func storeNotification(dir string, event incidentEvent) (bool, error) {
	file, err := os.CreateTemp(dir, ".pending-")
	if err != nil {
		return false, err
	}
	defer os.Remove(file.Name())
	if err := json.NewEncoder(file).Encode(event); err != nil {
		file.Close()
		return false, err
	}
	if err := file.Sync(); err != nil {
		file.Close()
		return false, err
	}
	if err := file.Close(); err != nil {
		return false, err
	}

	path := filepath.Join(dir, event.EventID+".json")
	err = os.Link(file.Name(), path)
	if err != nil && !errors.Is(err, os.ErrExist) {
		return false, err
	}
	created := err == nil
	directory, err := os.Open(dir)
	if err != nil {
		return false, err
	}
	defer directory.Close()
	return created, directory.Sync()
}

func consumeIncidentEvents(address, dir string) error {
	connection, err := amqp.Dial(address)
	if err != nil {
		return err
	}
	defer connection.Close()
	channel, err := connection.Channel()
	if err != nil {
		return err
	}
	defer channel.Close()

	if err := channel.ExchangeDeclare(eventExchange, "topic", true, false, false, false, nil); err != nil {
		return err
	}
	if _, err := channel.QueueDeclare(deadLetterQueue, true, false, false, false, nil); err != nil {
		return err
	}
	if _, err := channel.QueueDeclare(notificationQueue, true, false, false, false, amqp.Table{
		"x-queue-type":              "quorum",
		"x-single-active-consumer":  true,
		"x-delivery-limit":          int32(5),
		"x-dead-letter-exchange":    "",
		"x-dead-letter-routing-key": deadLetterQueue,
	}); err != nil {
		return err
	}
	if err := channel.QueueBind(notificationQueue, "incident.*", eventExchange, false, nil); err != nil {
		return err
	}
	if err := channel.Qos(1, 0, false); err != nil {
		return err
	}
	deliveries, err := channel.Consume(notificationQueue, "", false, false, false, false, nil)
	if err != nil {
		return err
	}
	for delivery := range deliveries {
		event, err := parseEvent(delivery.Body, delivery.RoutingKey, delivery.MessageId)
		if err != nil {
			log.Print("Rejecting malformed incident event")
			if err := delivery.Reject(false); err != nil {
				return err
			}
			continue
		}
		created, err := storeNotification(dir, event)
		if err != nil {
			log.Printf("Could not store incident event %s: %v", event.EventID, err)
			if err := delivery.Reject(true); err != nil {
				return err
			}
			continue
		}
		if created {
			log.Printf("Recorded %s event %s for incident %s", event.Type, event.EventID, event.IncidentID)
		}
		if err := delivery.Ack(false); err != nil {
			return err
		}
	}
	return errors.New("RabbitMQ consumer closed")
}

func runIncidentConsumer(host, dir string) {
	address := url.URL{
		Scheme: "amqp",
		Host:   net.JoinHostPort(host, "5672"),
		User:   url.UserPassword(os.Getenv("RABBITMQ_USER"), os.Getenv("RABBITMQ_PASSWORD")),
	}
	for {
		if err := consumeIncidentEvents(address.String(), dir); err != nil {
			log.Printf("Incident consumer disconnected: %v", err)
		}
		time.Sleep(2 * time.Second)
	}
}
