package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestNotificationRecordIsIdempotent(t *testing.T) {
	event := incidentEvent{
		EventID:    "63ec7a94-6f82-41f0-a0bd-593c09f108a4",
		Type:       "incident.opened",
		Version:    1,
		MonitorID:  "f57541a1-2994-41ef-924a-1ee214950678",
		IncidentID: "5f733bb6-c784-46bd-ad3b-aec7d26536dd",
		OccurredAt: time.Now().UTC(),
	}
	body, err := json.Marshal(event)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := parseEvent(body, "incident.resolved", event.EventID); err == nil {
		t.Fatal("accepted an event whose routing key disagrees with its type")
	}
	parsed, err := parseEvent(body, event.Type, event.EventID)
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	for _, expected := range []bool{true, false} {
		created, err := storeNotification(dir, parsed)
		if err != nil || created != expected {
			t.Fatalf("created = %t, want %t, error = %v", created, expected, err)
		}
	}
	entries, err := os.ReadDir(dir)
	if err != nil || len(entries) != 1 {
		t.Fatalf("notification directory = %v, error = %v", entries, err)
	}
	record, err := os.ReadFile(filepath.Join(dir, event.EventID+".json"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := parseEvent(record, event.Type, event.EventID); err != nil {
		t.Fatal(err)
	}
}
