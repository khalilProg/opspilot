package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func router() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "UP"})
	})
	mux.HandleFunc("GET /api/info", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"service": "notification-service", "version": "0.1.0"})
	})
	return mux
}

func main() {
	check := flag.Bool("healthcheck", false, "query the local health endpoint and exit")
	flag.Parse()
	if *check {
		client := http.Client{Timeout: 3 * time.Second}
		resp, err := client.Get("http://127.0.0.1:8080/health")
		if err != nil {
			log.Print(err)
			os.Exit(1)
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		return
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	consumerDone := make(chan struct{})
	if host := os.Getenv("RABBITMQ_HOST"); host != "" {
		dir := os.Getenv("NOTIFICATION_DATA_DIR")
		if dir == "" {
			dir = "data"
		}
		if err := os.MkdirAll(dir, 0700); err != nil {
			log.Fatal(err)
		}
		sink, err := newNotificationSink(dir, os.Getenv("NOTIFICATION_WEBHOOK_URL"))
		if err != nil {
			log.Fatal(err)
		}
		go func() {
			defer close(consumerDone)
			runIncidentConsumer(ctx, host, sink)
		}()
	} else {
		close(consumerDone)
	}
	server := &http.Server{Addr: ":8080", Handler: router(), ReadHeaderTimeout: 5 * time.Second}
	log.Println("notification-service listening on :8080")
	serverDone := make(chan error, 1)
	var serverError error
	go func() { serverDone <- server.ListenAndServe() }()
	select {
	case <-ctx.Done():
	case err := <-serverDone:
		if !errors.Is(err, http.ErrServerClosed) {
			serverError = err
		}
		stop()
	}
	shutdown, cancel := context.WithTimeout(context.Background(), 12*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdown); err != nil {
		log.Printf("HTTP shutdown: %v", err)
	}
	select {
	case <-consumerDone:
		log.Print("Notification service shut down")
	case <-shutdown.Done():
		log.Print("Timed out waiting for the notification consumer")
	}
	if serverError != nil {
		log.Fatal(serverError)
	}
}
