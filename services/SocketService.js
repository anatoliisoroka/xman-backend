const io = require('socket.io-client')
require('dotenv').config()

class Socket {
  constructor (userId) {
    this.userId = userId
  }

  channel (channel) {
    const emit = (channelId, data) => {
      const endpoint = `${process.env.PROTOCOL}://${process.env.SOCKET_ENDPOINT}`
      const options = {
        transports: ['websocket'],
        query: { token: this.userId }
      }
      const socket = io(endpoint, options)
      socket.on('connect', () => {
        socket.emit('init:namespace', this.userId)
        socket.on(`init:namespace:${this.userId}`, () => {
          const nsp = io(`${endpoint}/${this.userId}`, options)
          nsp.on('connect', () => {
            nsp.emit(channel, { channelId, data })
            socket.close()
            nsp.close()
          })
        })
      })
    }
    return { emit }
  }
}

module.exports = Socket
