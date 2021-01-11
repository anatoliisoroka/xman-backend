const axios = require('axios')
const _ = require('lodash')
const DB = require('../db/driver')

const config = {
  endpoint: '',
  token: '',
  count: 1,
  phone: '',
  message: 'chat-api',
  image: 'https://jpeg.org/images/jpegsystems-home.jpg',
  filename: 'xyz.jpeg'
}

class ChatApi {
  constructor (endpoint, token) {
    this.endpoint = endpoint
    this.token = token
  }
  text () {
    const payload = {
      phone: config.phone,
      body: config.message
    }
    return axios.post(`${this.endpoint}/sendMessage?token=${this.token}`, payload)
  }
  media () {
    const payload = {
      phone: config.phone,
      body: config.image,
      filename: config.filename
    }
    return axios.post(`${this.endpoint}/sendFile?token=${this.token}`, payload)
  }
  send () {
    return new Promise((resolve, reject) => {
      this.text()
        .then(result => {
          this.store(this.serialize(result))
          this.media()
            .then(result => {
              this.store(this.serialize(result))
              resolve()
            })
            .catch(error => {
              this.store(this.serialize(error))
              reject(error)
            })
        }).catch(error => {
          this.store(this.serialize(error))
          reject(error)
        })
    })
  }
  benchmark (count) {
    const bulk = _.map(_.range(count), i => this.send())
    Promise.all(bulk)
      .then(() => console.log('Successfully completed'))
      .catch(error => console.error(error))
  }
  store (data) {
    const db = DB.get()
    db.collection('benchmark')
      .insertOne(data)
      .catch(error => console.error(error))
  }
  serialize (error) {
    return JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error)))
  }
}

DB.connect()
  .then(() => {
    new ChatApi(config.endpoint, config.token).benchmark(config.count)
  }).catch(error => console.error(error))
