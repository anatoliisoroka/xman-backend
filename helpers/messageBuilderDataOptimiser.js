const _ = require('lodash')
const nanoid = require('nanoid')
const wavToOga = require('wav-oga-opus-converter')
const { Storage } = require('../services')

function messageBuilderDataOptimiser (customerId, messages) {
  function resizePhotos (messages) {
    function resize (message) {
      return new Promise((resolve, reject) => {
        if (message.type !== 'image') return resolve(message)
        if (_.includes(message.data, 'https://', 'http://')) return resolve(message)
        resolve(message)
      })
    }
    const bulkResize = () => messages.map(message => resize(message))
    return Promise.all(bulkResize())
  }
  function storeFile (messages) {
    function store (message) {
      return new Promise((resolve, reject) => {
        if (!['ptt', 'document', 'image', 'audio', 'video'].includes(message.type)) return resolve(message)
        if (_.includes(message.data, 'https://', 'http://')) return resolve(message)
        const { type } = message
        const isPTT = (type === 'ptt')
        const isDoc = (['document', 'audio', 'video'].includes(type))
        const extension = isPTT ? 'oga' : _.last(message.meta.split('.'))
        const filepath = `${type}/${customerId}/${nanoid()}.${extension}`
        const mimeType = isPTT ? 'audio/oga' : isDoc ? `application/${extension}` : 'image/jpeg'
        new Storage().put(message.data, filepath, mimeType)
          .then(url => {
            message.data = url
            resolve(message)
          }).catch(error => reject(error))
      })
    }
    const bulkStore = () => messages.map(message => store(message))
    return Promise.all(bulkStore())
  }
  function encodeOpus (messages) {
    function encode (message) {
      return new Promise((resolve, reject) => {
        if (message.type !== 'ptt') return resolve(message)
        if (_.includes(message.data, 'https://', 'http://')) return resolve(message)
        wavToOga(message.data)
          .then(oga => {
            message.data = oga
            resolve(message)
          }).catch(error => reject(error))
      })
    }
    const bulkEncode = () => messages.map(message => encode(message))
    return Promise.all(bulkEncode())
  }
  return new Promise((resolve, reject) => {
    if (_.isEmpty(messages)) return resolve(messages)
    resizePhotos(messages)
      .then(messages => {
        encodeOpus(messages)
          .then(messages => {
            storeFile(messages)
              .then(messages => resolve(messages))
              .catch(() => reject(Error('Unable to store media messages. Please try again later')))
          }).catch(() => reject(Error('Unable to encode voice messages. Please try again later')))
      }).catch(() => reject(Error('Unable to resize photo. Please try again later')))
  })
}

module.exports = messageBuilderDataOptimiser
