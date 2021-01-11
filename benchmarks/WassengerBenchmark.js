const axios = require('axios')
const _ = require('lodash')
const DB = require('../db/driver')

const config = {
  endpoint: 'https://api.wassenger.com/v1/messages',
  token: '',
  count: 2,
  phone: '',
  message: 'Wassenger',
  imageCaption: 'Wassenger - image',
  url: 'https://jpeg.org/images/jpegsystems-home.jpg',
  filename: 'xyz.jpeg'
}

class Wassenger {
  constructor (endpoint, token) {
    this.endpoint = endpoint
    this.token = token
  }
  text () {
    return axios.post(
      config.endpoint,
      { phone: config.phone,
        message: config.message
      },
      { headers:
        { token: config.token, 'content-type': 'application/json' } })
  }
  upload () {
    return new Promise((resolve, reject) => {
      axios.post(
        'https://api.wassenger.com/v1/files',
        { phone: config.phone,
          url: config.url,
          format: 'native'
        },
        { headers:
          { token: config.token, 'content-type': 'application/json' }
        })
        .then(result => {
          const imageId = result.data[0].id
          this.store(this.serialize(result))
          resolve(imageId)
        }).catch(error => {
          this.store(this.serialize(error))
          reject(error)
        })
    })
  }
  media (imageId) {
    return axios.post(
      config.endpoint,
      { phone: config.phone,
        message: config.imageCaption,
        media: {
          file: imageId,
          format: 'native'
        }
      },
      { headers: { token: config.token, 'content-type': 'application/json' } })
  }
  send (imageId) {
    return new Promise((resolve, reject) => {
      this.text()
        .then(result => {
          this.store(this.serialize(result))
          this.media(imageId)
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
  benchmark (count, imageId) {
    const bulk = _.map(_.range(count), i => this.send(imageId))
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
    new Wassenger()
      .upload()
      .then(imageId => {
        new Wassenger(config.endpoint, config.token).benchmark(config.count, imageId)
      }).catch(error => console.error(error))
  }).catch(error => console.error(error))
