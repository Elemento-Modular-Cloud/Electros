#!/bin/bash

LOG_FILE=/var/log/elemento/elemento_daemons.log

trap '' PIPE

# Read and discard HTTP request headers
while IFS= read -r line; do
  [ "$line" = $'\r' ] && break
done

# Send HTTP headers
printf "HTTP/1.1 200 OK\r\n"
printf "Content-Type: text/plain\r\n"
printf "Transfer-Encoding: chunked\r\n"
printf "Cache-Control: no-cache\r\n"
printf "Connection: keep-alive\r\n"
printf "\r\n"

# Send last 1000 lines
tail -n 1000 "$LOG_FILE" | while IFS= read line; do
  chunk="${line}\n"
  len=$(printf "%s" "$chunk" | wc -c)
  printf "%x\r\n%s\r\n" "$len" "$chunk" || break
done

# Follow file
# shellcheck disable=SC2162
tail -n 0 -F "$LOG_FILE" | while IFS= read line; do
  chunk="${line}\n"
  len=$(printf "%s" "$chunk" | wc -c)
  printf "%x\r\n%s\r\n" "$len" "$chunk" || break
done


