#!/bin/sh

PORT=5142

socat TCP-LISTEN:"$PORT",reuseaddr,fork SYSTEM:'bash -c /opt/app/follow_log.sh'
