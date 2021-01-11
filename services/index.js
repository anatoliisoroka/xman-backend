const MongoDB = require('./MongoDBService')
const Redis = require('./RedisService')
const Socket = require('./SocketService')
const Logging = require('./LoggingService')
const Queue = require('./QueueService')
const Storage = require('./StorageService')
const ChatApi = require('./ChatApiService')

module.exports = {
  MongoDB,
  Redis,
  Socket,
  Logging,
  Queue,
  Storage,
  ChatApi
}
