const axios = require('axios')
const Logging = require('./LoggingService')

class ChatApi {
  constructor (endpoint, token) {
    this.endpoint = endpoint
    this.token = token
  }

  send () {
    const text = (payload) => {
      return new Promise((resolve, reject) => {
        axios.post(`${this.endpoint}/sendMessage?token=${this.token}`, payload)
          .then(response => {
            new Logging('sendMessage').success('chat-api', response)
            resolve(response)
          }).catch(error => {
            new Logging('sendMessage').error('chat-api', error)
            reject(error)
          })
      })
    }
    const file = (payload) => {
      return new Promise((resolve, reject) => {
        axios.post(`${this.endpoint}/sendFile?token=${this.token}`, payload)
          .then(response => {
            new Logging('sendFile').success('chat-api', response)
            resolve(response)
          }).catch(error => {
            new Logging('sendFile').error('chat-api', error)
            reject(error)
          })
      })
    }
    const ptt = (payload) => {
      return new Promise((resolve, reject) => {
        axios.post(`${this.endpoint}/sendPTT?token=${this.token}`, payload)
          .then(response => {
            new Logging('sendPTT').success('chat-api', response)
            resolve(response)
          }).catch(error => {
            new Logging('sendPTT').error('chat-api', error)
            reject(error)
          })
      })
    }
    const vcard = (payload, instanceId) => {
      return new Promise((resolve, reject) => {
        axios.post(`${process.env.CHATAPI_V2_ENDPOINT}/instance${instanceId}/sendVCard?token=${this.token}`, payload)
          .then(response => {
            new Logging('sendVCard').success('chat-api', response)
            resolve(response)
          }).catch(error => {
            new Logging('sendVCard').error('chat-api', error)
            reject(error)
          })
      })
    }
    const link = (payload) => {
      return new Promise((resolve, reject) => {
        axios.post(`${this.endpoint}/sendLink?token=${this.token}`, payload)
          .then(response => {
            new Logging('sendLink').success('chat-api', response)
            resolve(response)
          }).catch(error => {
            new Logging('sendLink').error('chat-api', error)
            reject(error)
          })
      })
    }
    const location = (instanceId, payload) => {
      return new Promise((resolve, reject) => {
        axios.post(`${process.env.CHATAPI_V2_ENDPOINT}/instance${instanceId}/sendLocation?token=${this.token}`, payload)
          .then(response => {
            new Logging('sendLocation').success('chat-api', response)
            resolve(response)
          }).catch(error => {
            new Logging('sendLocation').error('chat-api', error)
            reject(error)
          })
      })
    }
    return { text, file, ptt, vcard, link, location }
  }

  readChat (payload) {
    return new Promise((resolve, reject) => {
      axios.post(`${this.endpoint}/readChat?token=${this.token}`, payload)
        .then(response => {
          new Logging('readChat').success('chat-api', response)
          resolve(response)
        }).catch(error => {
          new Logging('readChat').error('chat-api', error)
          reject(error)
        })
    })
  }

  forwardMessage (payload) {
    return new Promise((resolve, reject) => {
      axios.post(`${this.endpoint}/forwardMessage?token=${this.token}`, payload)
        .then(response => {
          new Logging('forwardMessage').success('chat-api', response)
          resolve(response)
        }).catch(error => {
          new Logging('forwardMessage').error('chat-api', error)
          reject(error)
        })
    })
  }

  showMessagesQueue (instanceId) {
    return new Promise((resolve, reject) => {
      axios.post(`${process.env.CHATAPI_V2_ENDPOINT}/instance${instanceId}/showMessagesQueue?token=${this.token}`)
        .then(response => {
          new Logging('showMessagesQueue').success('chat-api', response)
          resolve(response)
        }).catch(error => {
          new Logging('showMessagesQueue').error('chat-api', error)
          reject(error)
        })
    })
  }

  clearMessagesQueue (instanceId) {
    return new Promise((resolve, reject) => {
      axios.post(`${process.env.CHATAPI_V2_ENDPOINT}/instance${instanceId}/clearMessagesQueue?token=${this.token}`)
        .then(response => {
          new Logging('clearMessagesQueue').success('chat-api', response)
          resolve(response)
        }).catch(error => {
          new Logging('clearMessagesQueue').error('chat-api', error)
          reject(error)
        })
    })
  }

  retry (instanceId) {
    return new Promise((resolve, reject) => {
      axios.post(`${process.env.CHATAPI_V2_ENDPOINT}/instance${instanceId}/retry?token=${this.token}`)
        .then(response => {
          new Logging('retry').success('chat-api', response)
          resolve(response)
        }).catch(error => {
          new Logging('retry').error('chat-api', error)
          reject(error)
        })
    })
  }

  takeover (instanceId) {
    return new Promise((resolve, reject) => {
      axios.post(`${process.env.CHATAPI_V2_ENDPOINT}/instance${instanceId}/takeover?token=${this.token}`)
        .then(response => {
          new Logging('takeover').success('chat-api', response)
          resolve(response)
        }).catch(error => {
          new Logging('takeover').error('chat-api', error)
          reject(error)
        })
    })
  }

  logout () {
    return new Promise((resolve, reject) => {
      axios.post(`${this.endpoint}/logout?token=${this.token}`)
        .then(response => {
          new Logging('logout').success('chat-api', response)
          resolve(response)
        }).catch(error => {
          new Logging('logout').error('chat-api', error)
          reject(error)
        })
    })
  }

  status () {
    return new Promise((resolve, reject) => {
      axios.get(`${this.endpoint}/status?token=${this.token}`)
        .then(response => {
          new Logging('status').success('chat-api', response)
          resolve(response)
        }).catch(error => {
          new Logging('status').error('chat-api', error)
          reject(error)
        })
    })
  }
}

module.exports = ChatApi
