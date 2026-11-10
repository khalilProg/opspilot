FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY main.go events.go notification.go ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /notification-service .

FROM alpine:3.22
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
RUN mkdir /app/data && chown app:app /app/data
COPY --from=build --chown=app:app /notification-service /app/notification-service
USER app
EXPOSE 8080
ENTRYPOINT ["/app/notification-service"]
