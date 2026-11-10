package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"time"
)

var errWebhookRejected = errors.New("webhook rejected notification")

type notification struct {
	incidentEvent
	Title   string `json:"title"`
	Message string `json:"message"`
}

type notificationSink struct {
	dir     string
	webhook string
	client  *http.Client
	logger  *slog.Logger
}

func newNotificationSink(dir, webhook string) (*notificationSink, error) {
	if webhook != "" {
		target, err := url.Parse(webhook)
		if err != nil || target.Hostname() == "" || target.User != nil || target.Fragment != "" ||
			(target.Scheme != "http" && target.Scheme != "https") {
			return nil, errors.New("NOTIFICATION_WEBHOOK_URL must be an absolute HTTP(S) URL without credentials or a fragment")
		}
	}
	return &notificationSink{
		dir: dir, webhook: webhook,
		client: &http.Client{
			Timeout: 5 * time.Second,
			CheckRedirect: func(*http.Request, []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
		logger: slog.New(slog.NewJSONHandler(os.Stdout, nil)),
	}, nil
}

func (sink *notificationSink) process(event incidentEvent) error {
	path := filepath.Join(sink.dir, event.EventID+".json")
	if info, err := os.Lstat(path); err == nil {
		if !info.Mode().IsRegular() {
			return errors.New("notification record is not a regular file")
		}
		return syncDirectory(sink.dir)
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}

	title := "Incident opened"
	if event.Type == "incident.resolved" {
		title = "Incident resolved"
	}
	notice := notification{event, title, fmt.Sprintf("%s for monitor %s", title, event.MonitorID)}
	if sink.webhook != "" {
		if err := sink.deliverWebhook(notice); err != nil {
			return err
		}
	}
	created, err := storeNotification(sink.dir, notice)
	if err == nil && created && sink.webhook == "" {
		sink.logger.Info("incident notification", "notification", notice)
	}
	return err
}

func (sink *notificationSink) deliverWebhook(notice notification) error {
	body, err := json.Marshal(notice)
	if err != nil {
		return err
	}
	request, err := http.NewRequest(http.MethodPost, sink.webhook, bytes.NewReader(body))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Idempotency-Key", notice.EventID)
	response, err := sink.client.Do(request)
	if err != nil {
		return errors.New("webhook request failed")
	}
	defer response.Body.Close()
	status := response.StatusCode
	if status >= 200 && status < 300 {
		return nil
	}
	if status == http.StatusRequestTimeout || status == http.StatusTooManyRequests || status >= 500 {
		return fmt.Errorf("temporary webhook failure: HTTP %d", status)
	}
	return fmt.Errorf("%w: HTTP %d", errWebhookRejected, status)
}

func syncDirectory(dir string) error {
	directory, err := os.Open(dir)
	if err != nil {
		return err
	}
	defer directory.Close()
	return directory.Sync()
}
