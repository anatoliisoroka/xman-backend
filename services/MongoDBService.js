const { MongoClient } = require('mongodb')

class MongoDBService {
  constructor () {
    this.db = {}
    this.client = {}
  }
  static connect () {
    return new Promise((resolve, reject) => {
      MongoClient.connect(
        process.env.MONGODB_URI,
        { useNewUrlParser: true },
        (error, client) => {
          if (error) return reject(error)
          this.client = client
          this.db = client.db(process.env.DB_NAME)
          resolve()
        })
    })
  }
  static get () {
    return this.db
  }
  static close () {
    return this.client.close()
  }
}

module.exports = MongoDBService
