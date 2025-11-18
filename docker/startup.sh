#! /bin/bash

# start background daemons

/opt/daemons/elemento_daemons_linux_x86 > /var/log/elemento_daemons.log 2>&1 & 

# run the project

nginx -g 'daemon off;'