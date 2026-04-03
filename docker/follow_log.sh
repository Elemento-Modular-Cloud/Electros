#!/bin/bash
# #******************************************************************************#
# # Copyright(c) 2019-2026, Elemento srl, All rights reserved                    #
# # Author: Elemento srl                                                         #
# # Contributors are mentioned in the code where appropriate.                    #
# # Permission to use and modify this software and its documentation strictly    #
# # for personal purposes is hereby granted without fee,                         #
# # provided that the above copyright notice appears in all copies               #
# # and that both the copyright notice and this permission notice appear in the  #
# # supporting documentation.                                                    #
# # Modifications to this work are allowed for personal use.                     #
# # Such modifications have to be licensed under a                               #
# # Creative Commons BY-NC-ND 4.0 International License available at             #
# # http://creativecommons.org/licenses/by-nc-nd/4.0/ and have to be made        #
# # available to the Elemento user community                                     #
# # through the original distribution channels.                                  #
# # The authors make no claims about the suitability                             #
# # of this software for any purpose.                                            #
# # It is provided "as is" without express or implied warranty.                  #
# #******************************************************************************#
#
# #------------------------------------------------------------------------------#
# #Electros                                                                      #
# #Authors:                                                                      #
# #- Simone Robaldo (srobaldo at elemento.cloud)                                 #
# #------------------------------------------------------------------------------#
#

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
