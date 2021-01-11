# Xman
Web application

#### Credentials
[Gist](https://gist.github.com/renjithspace/3cc1f23c9933d182b9c5616ec72da604)

#### Configurations
1. Install `NodeJS` and `MongoDB`
2. Configure `.env` and `client/src/config.json`


#### Development
After configuration
1. Install dependencies
```sh
$ npm i
```
2. Serve
```
$ npm run serve:server
$ npm run serve:client
```

#### Staging
After configuration
1. Set `mongodb` credentilals from `docker-compose.yml`
2. Make sure to expose `SOCKET_PORT` and `API_PORT` from GCP Firewall rules
3. Build and run docker containers
```sh
$ docker-compose up --build -d
```

### Deployment
1. Create a [VM instance](https://console.cloud.google.com/compute/instances) in 16vCPUs, 60GB, 1TB in Ubuntu 18.04
2. Go to [Cloud DNS](https://console.cloud.google.com/net-services/dns) and set `A records` for following subdomains
```
app.xman.tech
www.app.xman.tech
api.xman.tech
www.api.xman.tech
socket.xman.tech
www.socket.xman.tech
```
3. Install `Nginx`, `Certbot`, `Docker` and `Docker compose`
```
$ wget -qO- https://git.io/fjtcG | bash
```
4. Setup `SSH` for `GitHub` and add to [SSH and GPG keys](https://github.com/settings/keys) and clone [xman](https://github.com/xman/xman) repo
```
$ ssh-keygen -t rsa -b 4096 -C "email@example.com"
$ cat ~/.ssh/id_rsa.pub
```
```
$ cd ~
$ git clone git@github.com:xman/xman.git
$ cd xman
```
5. Checkout to release version
```
  $ git checkout version
```
6. Configure `nginx.conf` file
   1. Set `server_name`
   2. Set `Internal IP` for `proxy_pass`
   3. Set `proxy_pass` `port` same as `docker-stack.yml`
7. Initialize `nginx.conf`
```
$ cd ~/xman
$ sudo cp nginx.conf /etc/nginx/sites-available/xman
$ sudo ln -s /etc/nginx/sites-available/xman /etc/nginx/sites-enabled/xman
$ sudo nginx -t
```
8. Generate certificates for all domains with `certbot`
```
$ sudo certbot --nginx -d app.xman.tech -d www.app.xman.tech -d api.xman.tech -d www.api.xman.tech -d socket.xman.tech -d www.socket.xman.tech
```
9. Configure `.env`, `client/src/config.json` and set `port` same as `nginx.conf` in `docker-stack.yml`
   1. Make sure to set mongodb URI with `Internal IP` in `.env`
10.  Build and host service images
```
$ wget -qO- https://git.io/fjYZf | bash
```
11. Deploy stack
```
$ sudo docker swarm init
$ sudo docker stack deploy -c docker-stack.yml xman
```
12. Configure nginx
```
access_log off;
worker_processes 16;
worker_connections 2048;
```
13. Restart Nginx
```
$ sudo service nginx restart
```

### Production
1. Checkout to `staging` and then checkout to the `release version`
```
  $ git checkout staging
  $ get checkout releaseVersion
```
2.  Build and host service images
```
$ wget -qO- https://git.io/fjYZf | bash
```
3.  Deploy stack

Please note, don't re-deploy `mongodb` service again
```
$ sudo docker stack deploy --with-registry-auth -c docker-stack.prod.yml xman
```

### Backup and restore database
Backup
```
$ docker exec -it containerId /bin/sh
$ mongodump -u username -p password --authenticationDatabase admin --db xman -o ~/xman
$ docker cp containerId:~/xman ~/xman
```

Restore
```
$ docker cp ~/xman containerId:~/xman
$ docker exec -it containerId /bin/sh
$ mongorestore -u username -p password --authenticationDatabase admin --db xman ./xman
```