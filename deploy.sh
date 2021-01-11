#!bin/bash
sudo docker-compose build
sudo docker tag xman_api xman/api
sudo docker push xman/api
sudo docker stack deploy --with-registry-auth -c docker-stack.yml xman