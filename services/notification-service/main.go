package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"os"
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
		if err != nil { log.Print(err); os.Exit(1) }
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK { os.Exit(1) }
		return
	}
	server := &http.Server{Addr: ":8080", Handler: router(), ReadHeaderTimeout: 5 * time.Second}
	log.Println("notification-service listening on :8080")
	log.Fatal(server.ListenAndServe())
}
