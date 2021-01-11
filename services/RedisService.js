const redis = require('redis')

class RedisService {
  constructor () {
    this.connection = {}
  }
  static connect () {
    this.connection = redis.createClient({
      host: process.env.CACHE_REDIS_HOST,
      port: process.env.CACHE_REDIS_PORT,
      password: process.env.CACHE_REDIS_PASSWORD
    })
    this.connection.on('error', error => console.error(error))
  }
  static client () {
    return this.connection
  }
}

module.exports = RedisService
