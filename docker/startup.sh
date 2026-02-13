#! /bin/bash
# #******************************************************************************#
# # Copyright(c) 2019-2023, Elemento srl, All rights reserved                    #
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
# #- Filippo Ferrando Damillano (fferrando at elemento.cloud)                    #
# #------------------------------------------------------------------------------#
#
# start background daemons

/opt/daemons/elemento_daemons_linux_x86 >/var/log/elemento/elemento_daemons.log 2>&1 &
/opt/app/logger_stream.sh /dev/null &

# run the project

nginx -g 'daemon off;'

