const _ = require('lodash')
const Joi = require('joi')
const ObjectId = require('mongodb').ObjectId
const moment = require('moment')
const Controller = require('./Controller')
const { formatJoiError } = require('../helpers')
const { Keywords, SequenceMessages, Sequences, Subscriptions } = require('../model')

class SequencesController extends Controller {
  collectSequences (query) {
    return new Sequences().find(query)
  }

  updateSequence (query, data, options) {
    return new Sequences().updateOne(query, data, options)
  }

  getAll (req, res) {
    const customerId = req.body.customerId
    const collectSubscriptions = new Subscriptions().find({ customerId })
    const collectSequenceMessages = new SequenceMessages().find({ customerId })
    Promise.all([this.collectSequences({ customerId }), collectSubscriptions, collectSequenceMessages])
      .then(data => {
        var sequences = data[0]
        const subscriptions = data[1]
        const sequenceMessages = data[2]
        sequences = sequences.map(sequence => {
          const sequenceMessagesCount = _.countBy(subscriptions, { sequenceId: sequence._id.toString() }).true
          const subscribersCount = _.countBy(sequenceMessages, { sequenceId: sequence._id.toString() }).true
          sequence.subscribers = sequenceMessagesCount || 0
          sequence.messages = subscribersCount || 0
          return sequence
        })
        res.json(sequences)
      }).catch(() => res.status(403).end())
  }

  delete (req, res) {
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      sequenceId: Joi.string().required()
    }
    const { error, value } = Joi.validate(req.body, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, sequenceId } = value
    const deleteSequences = () => {
      return new Sequences()
        .deleteOne({ customerId, _id: ObjectId(sequenceId) })
    }
    const deleteSequenceMessages = () => {
      return new SequenceMessages()
        .deleteMany({ customerId, sequenceId: sequenceId })
    }
    const deleteSubscriptions = () => {
      return new Subscriptions()
        .deleteMany({ customerId, sequenceId: sequenceId })
    }
    const keywords = () => {
      const query = { customerId, 'meta.sequenceId': sequenceId }
      const data = { $unset: { 'meta.sequenceId': 1 }, $pull: { actions: 'addSubscription' } }
      return new Keywords()
        .updateMany(query, data)
    }
    Promise.all([deleteSequences(),
      deleteSequenceMessages(),
      deleteSubscriptions(),
      keywords()
    ]).then(() => res.status(200).end())
      .catch(() => res.status(403).end())
  }

  switchAvailability (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      sequenceId: Joi.string().required(),
      isEnabled: Joi.boolean().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, sequenceId, isEnabled } = value
    this.updateSequence({ customerId, _id: ObjectId(sequenceId) }, { $set: { isEnabled } }, { returnOriginal: false })
      .then(sequence => res.json(sequence))
      .catch(() => res.status(403).end())
  }

  get (req, res) {
    const customerId = req.body.customerId
    const sequenceId = req.query.sequenceId
    if (!sequenceId) res.status(422).json('sequenceId is required')
    new Sequences().findOne({ customerId, _id: ObjectId(sequenceId) })
      .then(sequence => res.json(sequence))
      .catch(() => res.status(403).end())
  }

  post (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      name: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, name } = value
    const query = { customerId, name, isEnabled: true, createdAt: moment().format() }
    new Sequences()
      .insertOne(query)
      .then(sequence => res.json(sequence))
      .catch(() => res.status(403).end())
  }

  patch (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      sequenceId: Joi.string().required(),
      name: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, sequenceId, name } = value
    const query = { _id: ObjectId(sequenceId), customerId }
    const options = { returnOriginal: false }
    this.updateSequence(query, { $set: { name } }, options)
      .then(sequences => res.json(sequences))
      .catch(() => res.status(403).end())
  }

  getUnsubscribed (req, res) {
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
    Promise.all(([this.collectSequences({ customerId }), collectSubscriptions()]))
      .then(result => {
        var sequences = _.first(result)
        const subscriptions = _.last(result)
        subscriptions.forEach(subscription => {
          sequences = _.reject(sequences, { _id: ObjectId(subscription.sequenceId) })
        })
        res.json(sequences)
      }).catch(() => res.status(403).end())
  }
}

module.exports = SequencesController
