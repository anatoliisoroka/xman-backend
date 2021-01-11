const Joi = require('joi')
const ObjectId = require('mongodb').ObjectId
const _ = require('lodash')
const moment = require('moment')
const Controller = require('./Controller')
const { formatJoiError, subscriptionJobsCreator } = require('../helpers')
const { Sequences, SubscriptionJobs, Subscriptions } = require('../model')

class SubscriptionsController extends Controller {
  collectSequence (query) {
    return new Sequences().findOne(query)
  }

  get (req, res) {
    const data = req.query
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      contactId: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, contactId } = value
    const collectSubscriptions = () => new Subscriptions().find({ customerId, contactId })
    const collectSequences = (subscriptions) => {
      return subscriptions.map(subscription => {
        return this.collectSequence({ _id: ObjectId(subscription.sequenceId) })
      })
    }
    collectSubscriptions()
      .then(subscriptions => {
        Promise.all(collectSequences(subscriptions))
          .then(sequences => {
            const subscriptionsWithSequence = subscriptions.map(subscription => {
              subscription.sequence = _.find(sequences, { _id: ObjectId(subscription.sequenceId) })
              return subscription
            })
            res.json(subscriptionsWithSequence)
          }).catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  put (req, res) {
    const { body: data, db } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      contactId: Joi.string().required(),
      sequenceId: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, contactId, sequenceId } = value
    function insertSubscription () {
      const data = {
        customerId,
        contactId,
        sequenceId,
        createdAt: moment().format()
      }
      return new Subscriptions()
        .insertOne(data)
    }
    Promise.all([insertSubscription(), this.collectSequence({ _id: ObjectId(sequenceId) })])
      .then(result => {
        const [subscription, sequence] = result
        subscription.sequence = sequence
        const payload = { db, customerId, contactId, sequenceId, subscription }
        subscriptionJobsCreator(payload)
        res.json(subscription)
      }).catch(() => res.status(403).end())
  }

  delete (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      subscriptionId: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, subscriptionId } = value
    const deleteSubscription = () => new Subscriptions().deleteOne({ customerId, _id: ObjectId(subscriptionId) })
    const deleteSubscriptionJobs = () => new SubscriptionJobs().deleteMany({ customerId, subscriptionId })
    deleteSubscription()
      .then(() => {
        deleteSubscriptionJobs()
          .then(() => res.status(200).end())
          .catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }
}

module.exports = SubscriptionsController
