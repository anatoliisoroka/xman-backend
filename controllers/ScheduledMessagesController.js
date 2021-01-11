const _ = require('lodash')
const Joi = require('joi')
const moment = require('moment-timezone')
const shortId = require('shortid')
const Controller = require('./Controller')
const { Customers, ScheduledMessages } = require('../model')
const { Storage } = require('../services')
const {
  formatJoiError,
  isValidWhatsappFileSize
} = require('../helpers')

class ScheduledMessagesController extends Controller {
  collectCustomer (query) {
    return new Customers().findOne(query)
  }

  get (req, res) {
    const { customerId } = req.body
    const { contactId } = req.params
    if (_.isEmpty(contactId)) return res.status(403).end()
    new ScheduledMessages().find({ customerId, contactId })
      .then(scheduledMessages => {
        scheduledMessages = _.orderBy(scheduledMessages, 'createdAt', 'desc')
        res.json(scheduledMessages)
      }).catch(() => res.status(403).end())
  }

  create (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      contactId: Joi.string().required(),
      message: Joi.string().required(),
      photo: Joi.string().allow(''),
      startAt: Joi.date().iso().required(),
      fileName: Joi.string().allow('')
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, contactId, message, startAt, photo, fileName } = value
    if (!_.isEmpty(photo) && !isValidWhatsappFileSize(photo)) return res.status(422).json({ error: 'photo_size_is_too_large' })
    function insertScheduledmessages (photo) {
      return new ScheduledMessages()
        .insertOne({
          customerId,
          contactId,
          message,
          photo,
          startAt: moment(startAt).format(),
          status: 'scheduled',
          createdAt: moment().format()
        })
    }
    function create (photo = '') {
      function isValidStartAt () {
        const now = moment().format()
        const sendable = moment(startAt, 'YYYY-MM-DDTHH:mm')
        const canAccept = sendable.isAfter(now)
        return canAccept
      }
      if (!isValidStartAt()) return res.status(422).json({ error: 'invalid_start_time' })
      insertScheduledmessages(photo)
        .then(message => res.json(message))
        .catch(() => res.status(403).end())
    }
    if (_.isEmpty(photo)) return create()
    const extension = _.last(fileName.split('.'))
    const uniqId = shortId.generate()
    const filepath = `images/${customerId}/${uniqId}.${extension}`
    const mimeType = 'image/jpeg'
    new Storage().put(photo, filepath, mimeType)
      .then(photo => create(photo))
      .catch(() => res.status(403).end())
  }
}

module.exports = ScheduledMessagesController
