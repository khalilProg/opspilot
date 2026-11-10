package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"
)

func TestWebhookRetryAndReplay(t *testing.T) {
	event := incidentEvent{
		EventID: "63ec7a94-6f82-41f0-a0bd-593c09f108a4", Type: "incident.opened", Version: 1,
		MonitorID: "f57541a1-2994-41ef-924a-1ee214950678", IncidentID: "5f733bb6-c784-46bd-ad3b-aec7d26536dd",
		OccurredAt: time.Now().UTC(),
	}
	var attempts atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload notification
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Error(err)
		}
		if r.Method != http.MethodPost || r.Header.Get("Idempotency-Key") != event.EventID ||
			payload.EventID != event.EventID || payload.Title != "Incident opened" || payload.Message == "" {
			t.Errorf("unexpected notification: %+v", payload)
		}
		if attempts.Add(1) == 1 {
			w.WriteHeader(http.StatusServiceUnavailable)
		} else {
			w.WriteHeader(http.StatusNoContent)
		}
	}))
	defer server.Close()
	dir := t.TempDir()
	sink, err := newNotificationSink(dir, server.URL)
	if err != nil {
		t.Fatal(err)
	}
	if err := sink.process(event); err == nil {
		t.Fatal("temporary webhook failure was accepted")
	}
	if _, err := os.Stat(filepath.Join(dir, event.EventID+".json")); !os.IsNotExist(err) {
		t.Fatalf("failed delivery created a receipt: %v", err)
	}
	if err := sink.process(event); err != nil {
		t.Fatal(err)
	}
	restarted, err := newNotificationSink(dir, server.URL)
	if err != nil {
		t.Fatal(err)
	}
	if err := restarted.process(event); err != nil {
		t.Fatal(err)
	}
	if got := attempts.Load(); got != 2 {
		t.Fatalf("received %d webhook attempts, want 2", got)
	}
}
