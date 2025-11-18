#! /bin/bash

# start background daemons

/opt/daemons/Elemento_Daemons_linux_x86 > /var/log/elemento/elemento_daemons.log 2>&1 & 

# run the project

nginx -g 'daemon off;'