const _ = require('lodash')
const Joi = require('joi')
const bcrypt = require('bcryptjs')
const moment = require('moment-timezone')
const shortId = require('shortid')
const Controller = require('./Controller')
const { formatJoiError } = require('../helpers')
const { Storage } = require('../services')
const { Customers, Teammates } = require('../model')

class AccountController extends Controller {
  collectCustomer (customerId) {
    const query = { _id: super.oid(customerId) }
    return new Customers()
      .findOne(query)
  }

  updateCustomer (query, data) {
    return new Customers()
      .updateOne(query, data)
  }

  updateTeammate (query, data) {
    return new Teammates()
      .updateOne(query, data)
  }

  timezoneConvert (time, timezone, type) {
    if (!timezone && !time) return time || ''
    time = moment(time, 'HH:mm').format('YYYY-MM-DD HH:mm')
    if (type === 'fromLocal') {
      time = moment.tz(time, moment.tz.guess())
      time = time.clone().tz(timezone)
    }
    if (type === 'toLocal') {
      time = moment.tz(time, timezone)
      time = time.clone().tz(moment.tz.guess())
    }
    return time.format('HH:mm')
  }

  get (req, res) {
    const { customerId, teammateId } = req.body
    const collectTeammate = () => {
      const query = { _id: super.oid(teammateId) }
      const options = { projection: { password: false } }
      return new Teammates()
        .findOne(query, options)
    }
    const convertTime = (customer) => {
      const { broadcastPause, offline, timezone } = customer
      const hasTimezone = !_.isEmpty(timezone)
      if (hasTimezone) {
        if (_.isObject(broadcastPause)) {
          broadcastPause.start = this.timezoneConvert(broadcastPause.start, timezone, 'fromLocal')
          broadcastPause.end = this.timezoneConvert(broadcastPause.end, timezone, 'fromLocal')
        }
        if (_.isObject(offline)) {
          offline.from = this.timezoneConvert(offline.from, timezone, 'fromLocal')
          offline.to = this.timezoneConvert(offline.to, timezone, 'fromLocal')
        }
      }
      return customer
    }
    this.collectCustomer(customerId)
      .then(customer => {
        collectTeammate()
          .then(teammate => {
            customer = convertTime(customer)
            const account = { customer, teammate }
            res.json(account)
          }).catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  patch (req, res) {
    const { body: data } = req
    const timeRegex = /^([0-9]{2}):([0-9]{2})$/
    const schema = {
      name: Joi.string().required(),
      photo: Joi.string().optional().allow(''),
      businessName: Joi.string().required(),
      email: Joi.string().email().required(),
      offlineContactEmail: Joi.string().email().allow(''),
      offline: Joi.object().keys({
        message: Joi.string().allow(''),
        from: Joi.string().regex(timeRegex).allow(''),
        to: Joi.string().regex(timeRegex).allow('')
      }),
      defaultMessage: Joi.string().allow(''),
      customerId: Joi.string().required(),
      teammateId: Joi.string().required(),
      timezone: Joi.string().allow(''),
      broadcastPause: Joi.object().keys({
        start: Joi.string().regex(timeRegex).allow(''),
        end: Joi.string().regex(timeRegex).allow('')
      })
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const {
      customerId,
      email,
      businessName,
      offlineContactEmail,
      offline,
      defaultMessage,
      teammateId,
      name,
      photo,
      timezone,
      broadcastPause
    } = value
    const updateCustomer = () => {
      const query = { _id: super.oid(customerId) }
      const data = {
        $set: {
          businessName,
          offlineContactEmail,
          timezone,
          offline: {
            message: offline.message,
            from: this.timezoneConvert(offline.from, timezone, 'toLocal'),
            to: this.timezoneConvert(offline.to, timezone, 'toLocal')
          },
          defaultMessage,
          broadcastPause: {
            start: this.timezoneConvert(broadcastPause.start, timezone, 'toLocal'),
            end: this.timezoneConvert(broadcastPause.end, timezone, 'toLocal')
          }
        }
      }
      return this.updateCustomer(query, data)
    }
    const updateTeammate = (resizedPhoto) => {
      const data = { name, email }
      if (!_.isEmpty(resizedPhoto)) data.photo = resizedPhoto
      return this.updateTeammate({ _id: super.oid(teammateId) }, { $set: data })
    }
    const checkCustomerExistance = () => {
      const query = { email, _id: { $ne: super.oid(customerId) } }
      return new Customers()
        .find(query)
    }
    const checkTeammateExistance = () => {
      const query = { email, _id: { $ne: super.oid(teammateId) } }
      return new Teammates()
        .find(query)
    }
    function accountUpdate (image) {
      Promise.all([checkCustomerExistance(), checkTeammateExistance()])
        .then(results => {
          const isExistCustomer = results[0].length
          const isExistTeammate = results[1].length
          if (isExistCustomer || isExistTeammate) {
            return res.status(422).json({ error: 'email_is_already_exists' })
          }
          Promise.all([updateCustomer(), updateTeammate(image)])
            .then(() => res.status(200).end())
            .catch(() => res.status(403).json({ error: 'something_went_wrong' }))
        }).catch(() => res.status(403).end())
    }
    const isDataUri = _.startsWith(photo, 'data:')
    if (isDataUri) {
      const uniqId = shortId.generate()
      const filepath = `images/${customerId}/${uniqId}.jpeg`
      const mimeType = 'image/jpeg'
      new Storage().put(photo, filepath, mimeType)
        .then(image => accountUpdate(image))
        .catch(() => res.status(403).end())
    } else accountUpdate()
  }

  updatePassword (req, res) {
    const { body: data } = req
    const schema = {
      password: Joi.string().min(6).required(),
      customerId: Joi.string().required(),
      teammateId: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { password, teammateId } = value
    const query = { _id: super.oid(teammateId) }
    const update = { $set: { password: bcrypt.hashSync(password, 10) } }
    this.updateTeammate(query, update)
      .then(() => res.status(200).json(true))
      .catch(() => res.status(403).end())
  }

  subscribeReplyUpdate (req, res) {
    const { body: data } = req
    const schema = {
      subscribeReply: Joi.string().required(),
      customerId: Joi.string().required(),
      teammateId: Joi.string().allow()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { subscribeReply, customerId } = value
    const query = { _id: super.oid(customerId) }
    const update = { $set: { subscribeReply } }
    this.updateCustomer(query, update)
      .then(() => res.status(200).json(true))
      .catch(() => res.status(403).end())
  }

  unsubscribeReplyUpdate (req, res) {
    const { body: data } = req
    const schema = {
      unsubscribeReply: Joi.string().required(),
      customerId: Joi.string().required(),
      teammateId: Joi.string().allow()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { unsubscribeReply, customerId } = value
    const query = { _id: super.oid(customerId) }
    const update = { $set: { unsubscribeReply } }
    this.updateCustomer(query, update)
      .then(() => res.status(200).json(true))
      .catch(() => res.status(403).end())
  }

  subscribeReply (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.string().allow()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId } = value
    this.collectCustomer(customerId)
      .then(customer => {
        const { subscribeReply, unsubscribeReply } = customer
        const data = { subscribeReply, unsubscribeReply }
        res.json(data)
      }).catch(() => res.status(403).end())
  }

  switchLanguage (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.string().allow(),
      lang: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, lang } = value
    const query = { _id: super.oid(customerId) }
    const update = { $set: { lang } }
    this.updateCustomer(query, update)
      .then(() => {
        res.cookie('lang', lang)
        res.status(200).json(true)
      }).catch(() => res.status(403).end())
  }
}

module.exports = AccountController
