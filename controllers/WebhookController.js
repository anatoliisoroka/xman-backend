const _ = require('lodash')
const moment = require('moment')
const Controller = require('./Controller')
const { Queue } = require('../services')
const { Customers } = require('../model')

class WebhookController extends Controller {
  post (req, res) {
    res.json('ok')
    const message = _.first(req.body.messages)
    const ack = _.first(req.body.ack)
    const isDeliveryStatus = !_.isEmpty(ack) && _.isObject(ack)
    const isMessage = !_.isEmpty(message) && _.isObject(message)
    const isValidRequest = isMessage || isDeliveryStatus
    const instanceId = req.params.instanceId
    const whatsapp = isMessage && _.first(_.split(message.chatId, '@'))
    const isGroupMessage = isMessage && whatsapp.split('-').length > 1
    const isWebhook = true
    if (!isValidRequest) return
    function isNewMessage () {
      const now = moment.unix(moment().format('X')).format()
      const timestamp = moment.unix(message.time).format()
      const minutesDiff = moment(now).diff(moment(timestamp), 'minutes')
      return minutesDiff < 5
    }
    if (isMessage && !isNewMessage()) return
    const collectCustomer = () => new Customers().findOne({ whatsappApiInstanceId: Number(instanceId) })
    collectCustomer()
      .then(customer => {
        if (_.isEmpty(customer)) throw new Error()
        const customerId = customer._id.toString()
        if (isDeliveryStatus) {
          new Queue().DeliveryStatus(customerId, ack)
        } else if (isGroupMessage) {
          new Queue().GroupMessageSync(customerId, message, isWebhook)
        } else if (isMessage) {
          new Queue().MessageSync(customerId, message, isWebhook)
        }
      }).catch(() => {})
  }
}

module.exports = WebhookController
