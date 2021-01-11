#!/bin/bash
# crontab sample: * * * * * /home/renjithrajeevvk/xman/scripts/nginx-restarter.sh

# Config
DOMAIN=app.xman.tech

response=$(curl --write-out %{http_code} --silent --head --output /dev/null https://${DOMAIN})
if [ $response != 200 ]
then
  /etc/init.d/nginx restart > /dev/null
fi