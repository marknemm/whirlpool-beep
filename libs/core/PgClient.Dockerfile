FROM alpine:latest
RUN apk --no-cache add bash postgresql16-client
ENTRYPOINT [ "psql" ]
