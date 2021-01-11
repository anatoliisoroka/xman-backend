const _ = require('lodash')
const axios = require('axios')
const request = axios.create({ baseURL: process.env.QUEUE_API_ENDPOINT })
const Logging = require('./LoggingService')

class QueueService {
  ContactsImport (customerId, teammateId, contacts) {
    if (_.isEmpty(contacts)) return
    const payload = { customerId, teammateId, contacts }
    return request.post('/contacts/import', payload)
      .then(response => new Logging('contactsImport').success('queue', response))
      .catch(error => new Logging('contactsImport').error('queue', error))
  }
  DeliveryStatus (customerId, ack) {
    if (_.isEmpty(ack)) return
    const payload = { customerId, ack }
    return request.post('/whatsapp/delivery-status/sync', payload)
      .then(response => new Logging('deliveryStatus').success('queue', response))
      .catch(error => new Logging('deliveryStatus').error('queue', error))
  }
  MessageSync (customerId, message, isWebhook) {
    if (_.isEmpty(message)) return
    if (!_.isArray(message)) message = [message]
    const payload = { customerId, messages: message, isWebhook }
    return request.post('/whatsapp/message/sync', payload)
      .then(response => new Logging('messageSync').success('queue', response))
      .catch(error => new Logging('messageSync').error('queue', error))
  }
  GroupMessageSync (customerId, message, isWebhook) {
    if (_.isEmpty(message)) return
    if (!_.isArray(message)) message = [message]
    const payload = { customerId, messages: message, isWebhook }
    return request.post('/whatsapp/group-message/sync', payload)
      .then(response => new Logging('GroupMessageSync').success('queue', response))
      .catch(error => new Logging('GroupMessageSync').error('queue', error))
  }
}

module.exports = QueueService
