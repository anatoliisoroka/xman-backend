#!/bin/bash
# crontab sample: 59 23 * * * /home/renjithrajeevvk/xman/scripts/db-backup.sh

# Config
CONTAINER_ID=id
DB_USERNAME=username
DB_PASSWORD=password
DB_NAME=xman
DB_BACKUP_PATH=/home/renjithrajeevvk/

docker exec -it $CONTAINER_ID mongodump -u $DB_USERNAME -p $DB_PASSWORD --authenticationDatabase admin --db $DB_NAME -o /db-backup > /dev/null && docker cp $CONTAINER_ID:/db-backup $DB_BACKUP_PATH > /dev/null