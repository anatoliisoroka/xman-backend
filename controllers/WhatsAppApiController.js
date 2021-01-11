const _ = require('lodash')
const Controller = require('./Controller')
const { Customers } = require('../model')
const { ChatApi } = require('../services')

class WhatsAppApiController extends Controller {
  collectCustomer (customerId) {
    return new Customers()
      .findOne({ _id: super.oid(customerId) })
  }

  parseQueueMessages (messages) {
    messages = messages.first100
    messages = messages.map(message => {
      message.metadata = JSON.parse(message.metadata)
      const data = { type: message.type }
      if (message.type === 'chat') data.data = message.body
      else if (message.type === 'audio') data.data = message.metadata.audio
      else if (message.type === 'location') {
        data.data = `${message.metadata.lat};${message.metadata.lng}`
        data.address = message.metadata.address
      } else if (message.type === 'file') {
        data.data = message.body
        data.filename = message.metadata.filename
      } else if (message.type === 'vCard') {
        data.data = _.trim(message.metadata.chatId, '@c.us')
        data.type = 'vcard'
        data.meta = ''
      }
      return { messages: [data], last_try: message.last_try }
    })
  }

  authCheck (req, res) {
    const { customerId } = req.body
    this.collectCustomer(customerId)
      .then(customer => {
        const { whatsappApiUrl, whatsappApiToken } = customer
        new ChatApi(whatsappApiUrl, whatsappApiToken)
          .status()
          .then(response => res.json(response.data))
          .catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  logout (req, res) {
    const { customerId } = req.body
    this.collectCustomer(customerId)
      .then(customer => {
        const { whatsappApiUrl, whatsappApiToken } = customer
        new ChatApi(whatsappApiUrl, whatsappApiToken)
          .logout()
          .then(response => res.json(response.data))
          .catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  takeover (req, res) {
    const { customerId } = req.body
    this.collectCustomer(customerId)
      .then(customer => {
        const { whatsappApiInstanceId, whatsappApiToken } = customer
        new ChatApi(null, whatsappApiToken)
          .takeover(whatsappApiInstanceId)
          .then(response => res.json(response.data))
          .catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  getMessagesQueue (req, res) {
    const { customerId } = req.body
    this.collectCustomer(customerId)
      .then(customer => {
        const { whatsappApiInstanceId, whatsappApiToken } = customer
        new ChatApi(null, whatsappApiToken)
          .showMessagesQueue(whatsappApiInstanceId)
          .then(response => {
            const result = this.parseQueueMessages(response.data)
            res.json(result)
          }).catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  clearMessagesQueue (req, res) {
    const { customerId } = req.body
    this.collectCustomer(customerId)
      .then(customer => {
        const { whatsappApiInstanceId, whatsappApiToken } = customer
        new ChatApi(null, whatsappApiToken)
          .clearMessagesQueue(whatsappApiInstanceId)
          .then(response => res.json(response.data))
          .catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  retry (req, res) {
    const { customerId } = req.body
    this.collectCustomer(customerId)
      .then(customer => {
        const { whatsappApiInstanceId, whatsappApiToken } = customer
        new ChatApi(null, whatsappApiToken)
          .retry(whatsappApiInstanceId)
          .then(() => res.status(200).end())
          .catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }
}

module.exports = WhatsAppApiController
