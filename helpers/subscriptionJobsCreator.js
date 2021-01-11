const { ObjectId } = require('mongodb')
const moment = require('moment')
const _ = require('lodash')
const { Customers, Contacts, SequenceMessages, SubscriptionJobs } = require('../model')

function subscriptionJobsCreator (payload) {
  const { customerId, contactId, sequenceId, subscription } = payload
  function collectCustomer () {
    return new Customers().findOne({ _id: ObjectId(customerId) })
  }
  function collectContact () {
    return new Contacts()
      .findOne({ _id: ObjectId(contactId), isBlocked: { $ne: true }, isUnsubscribed: { $ne: true } })
  }
  function collectSequenceMessages () {
    return new SequenceMessages().find({ sequenceId })
  }
  function messageSendOn (sequenceMessage, sendOn) {
    const schedule = sequenceMessage.schedule
    sendOn = moment(sendOn).add(schedule[0], schedule[1]).format()
    return sendOn
  }
  function insert (customer, contact, sequenceMessage, sendOn) {
    const { whatsappApiUrl, whatsappApiToken } = customer
    const { whatsapp: phone } = contact
    const { message, photo } = sequenceMessage
    const { data, filename } = photo
    const subscriptionId = subscription._id.toString()
    sendOn = moment(sendOn).format('LLL')
    return new SubscriptionJobs()
      .insertOne({
        customerId,
        subscriptionId,
        message,
        photo: { data, filename },
        phone,
        whatsappApiUrl,
        whatsappApiToken,
        sendOn
      })
  }
  Promise.all([collectCustomer(), collectContact(), collectSequenceMessages()])
    .then(result => {
      const [customer, contact, sequenceMessages] = result
      var sendOn = ''
      if (_.isEmpty(contact)) throw new Error('blocked contact')
      const bulkInsert = sequenceMessages.map(sequenceMessage => {
        sendOn = sendOn || subscription.createdAt
        sendOn = messageSendOn(sequenceMessage, sendOn)
        return insert(customer, contact, sequenceMessage, sendOn)
      })
      Promise.all(bulkInsert())
        .catch(() => {})
    }).catch(() => {})
}

module.exports = subscriptionJobsCreator
