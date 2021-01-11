const _ = require('lodash')

function isURL (message) {
  message = _.trim(message)
  const isSentance = Boolean(message.split(' ')[1])
  const hasURL = message.includes('http://') || message.includes('https://')
  const validURL = Boolean(message.split('http://')[1]) || Boolean(message.split('https://')[1])
  return hasURL && validURL && !isSentance
}

module.exports = isURL
