const Joi = require('joi')
const _ = require('lodash')
const ObjectId = require('mongodb').ObjectId
const moment = require('moment')
const shortId = require('shortid')
const Controller = require('./Controller')
const { SequenceMessages } = require('../model')
const { Storage } = require('../services')
const {
  formatJoiError,
  isValidWhatsappFileSize
} = require('../helpers')

class SequenceMessagesController extends Controller {
  updateSequenceMessage (query, data, options) {
    return new SequenceMessages().updateOne(query, data, options)
  }

  getAll (req, res) {
    const { customerId } = req.body
    const { sequenceId } = req.query
    if (!sequenceId) return res.status(422).end()
    new SequenceMessages().find({ customerId, sequenceId })
      .then(sequenceMessages => res.json(sequenceMessages))
      .catch(() => res.status(403).end())
  }

  delete (req, res) {
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      sequenceId: Joi.string().required(),
      sequenceMessageId: Joi.string().required()
    }
    const { error, value } = Joi.validate(req.body, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, sequenceId, sequenceMessageId } = value
    const query = { customerId, sequenceId, _id: ObjectId(sequenceMessageId) }
    new SequenceMessages()
      .deleteMany(query)
      .then(() => res.status(200).end())
      .catch(() => res.status(403).end())
  }

  switchAvailability (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      sequenceId: Joi.string().required(),
      sequenceMessageId: Joi.string().required(),
      isEnabled: Joi.boolean().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, sequenceId, sequenceMessageId, isEnabled } = value
    const query = { customerId, sequenceId, _id: ObjectId(sequenceMessageId) }
    const options = { returnOriginal: false }
    this.updateSequenceMessage(query, { $set: { isEnabled } }, options)
      .then(sequenceMessage => res.json(sequenceMessage))
      .catch(() => res.status(403).end())
  }

  post (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      sequenceId: Joi.string().required(),
      name: Joi.string().required(),
      message: Joi.string().required(),
      schedule: Joi.array().required(),
      photo: Joi.object().keys({ data: Joi.string().allow(''), filename: Joi.string().allow('') })
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, sequenceId, name, message, schedule, photo } = value
    const isValidDataUri = _.startsWith(photo.data, 'data:')
    if (photo.data && isValidDataUri && !isValidWhatsappFileSize(photo.data)) return res.status(422).json({ error: 'photo_size_is_too_large' })
    if (isValidDataUri) {
      const extension = _.last(photo.filename.split('.'))
      const uniqId = shortId.generate()
      const filepath = `images/${customerId}/${uniqId}.${extension}`
      const mimeType = 'image/jpeg'
      new Storage().put(photo.data, filepath, mimeType)
        .then(image => addSequenceMessage(image))
        .catch(() => res.status(403).end())
    } else addSequenceMessage()
    function addSequenceMessage (image) {
      if (!_.isEmpty(image)) { photo.data = image }
      const query = {
        customerId,
        sequenceId,
        name,
        message,
        schedule: [_.first(schedule), _.last(schedule)],
        photo,
        isEnabled: true,
        createdAt: moment().format()
      }
      new SequenceMessages()
        .insertOne(query)
        .then(sequenceMessage => res.json(sequenceMessage))
        .catch(() => res.status(403).end())
    }
  }

  patch (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      sequenceId: Joi.string().required(),
      sequenceMessageId: Joi.string().required(),
      name: Joi.string().required(),
      message: Joi.string().required(),
      schedule: Joi.array().required(),
      photo: Joi.object().keys({ data: Joi.string().allow(''), filename: Joi.string().allow('') })
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, sequenceId, sequenceMessageId, name, message, schedule, photo } = value
    const isValidDataUri = _.startsWith(photo.data, 'data:')
    if (photo.data && isValidDataUri && !isValidWhatsappFileSize(photo.data)) return res.status(422).json({ error: 'photo_size_is_too_large' })
    const editSequenceMessage = (image) => {
      if (!_.isEmpty(image)) { photo.data = image }
      const query = { customerId, sequenceId, _id: ObjectId(sequenceMessageId) }
      const data = { $set: { name, message, schedule, photo } }
      const options = { returnOriginal: false }
      this.updateSequenceMessage(query, data, options)
        .then(sequenceMessage => res.json(sequenceMessage))
        .catch(() => res.status(403).end())
    }
    if (isValidDataUri) {
      const extension = _.last(photo.filename.split('.'))
      const uniqId = shortId.generate()
      const filepath = `images/${customerId}/${uniqId}.${extension}`
      const mimeType = 'image/jpeg'
      new Storage().put(photo.data, filepath, mimeType)
        .then(image => editSequenceMessage(image))
        .catch(() => res.status(403).end())
    } else editSequenceMessage()
  }
}

module.exports = SequenceMessagesController
