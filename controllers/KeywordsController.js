const Joi = require('joi')
const _ = require('lodash')
const ObjectId = require('mongodb').ObjectId
const moment = require('moment')
const Controller = require('./Controller')
const { Keywords, Sequences, Tags } = require('../model')
const { formatJoiError, messageBuilderDataOptimiser } = require('../helpers')

class KeywordsController extends Controller {
  collectRelatedData (customerId, keyword) {
    const { meta } = keyword
    const { tags, sequenceId } = meta
    function collectTags (keyword) {
      return new Promise((resolve, reject) => {
        if (_.isEmpty(tags)) return resolve(keyword)
        function collect (tagId) {
          return new Tags()
            .findOne({ _id: ObjectId(tagId), customerId })
        }
        const collectBulkTags = () => tags.map(tagId => collect(tagId))
        Promise.all(collectBulkTags())
          .then(tags => {
            keyword.tags = tags
            resolve(keyword)
          }).catch(error => reject(error))
      })
    }
    function collectSequence (keyword) {
      return new Promise((resolve, reject) => {
        if (_.isEmpty(sequenceId)) return resolve(keyword)
        new Sequences().findOne({ _id: ObjectId(sequenceId), customerId })
          .then(sequence => {
            keyword.sequence = sequence
            resolve(keyword)
          }).catch(error => reject(error))
      })
    }
    return new Promise((resolve, reject) => {
      collectTags(keyword)
        .then(keyword => {
          collectSequence(keyword)
            .then(keyword => resolve(keyword))
            .catch(error => reject(error))
        }).catch(error => reject(error))
    })
  }

  collectTagIds (customerId, meta) {
    var { tags } = meta
    function collectTag (name) {
      name = _.trim(name)
      function insert (name, customerId) {
        return new Tags()
          .insertOne({
            customerId,
            name,
            createdAt: moment().format()
          })
      }
      return new Promise((resolve, reject) => {
        new Tags().findOne({ name, customerId })
          .then(tag => {
            if (!_.isEmpty(tag)) return resolve(tag._id.toString())
            insert(name, customerId)
              .then(tag => resolve(tag._id.toString()))
              .catch(error => reject(error))
          }).catch(error => reject(error))
      })
    }
    return new Promise((resolve, reject) => {
      if (_.isEmpty(tags)) return resolve(meta)
      tags = _.uniq(tags)
      const collectBulkTags = () => tags.map(name => collectTag(name))
      Promise.all(collectBulkTags())
        .then(result => {
          meta.tags = result
          resolve(meta)
        }).catch(error => reject(error))
    })
  }

  getAll (req, res) {
    const { customerId } = req.body
    const collectKeywords = () => new Keywords().find({ customerId })
    collectKeywords()
      .then(keywords => {
        const bulkCollectRelatedData = () => keywords.map(keyword => this.collectRelatedData(customerId, keyword))
        Promise.all(bulkCollectRelatedData())
          .then(keywords => {
            keywords = _.orderBy(keywords, 'createdAt', 'desc')
            res.json(keywords)
          }).catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  delete (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      keywordId: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, keywordId } = value
    new Keywords()
      .deleteOne({ customerId, _id: ObjectId(keywordId) })
      .then(() => res.status(200).end())
      .catch(() => res.status(403).end())
  }

  switchAvailability (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      keywordId: Joi.string().required(),
      isEnabled: Joi.boolean().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, keywordId, isEnabled } = value
    new Keywords()
      .updateOne(
        { customerId, _id: ObjectId(keywordId) },
        { $set: { isEnabled } },
        { returnOriginal: false }
      ).then(keyword => res.json(keyword.value))
      .catch(() => res.status(403).end())
  }

  post (req, res) {
    const { body: data } = req
    const { actions } = data
    var metaValidate = {}
    if (actions.includes('reply')) {
      _.assign(metaValidate, {
        messages: Joi.array().items(Joi.object().keys({
          type: Joi.string().required(),
          data: Joi.string().required(),
          meta: Joi.string().optional().allow('')
        })).min(1).required()
      })
    }
    if (actions.includes('addSubscription')) _.assign(metaValidate, { sequenceId: Joi.string().required() })
    if (actions.includes('addTag')) {
      _.assign(metaValidate, {
        tags: Joi.array().items(Joi.string().trim().required()).required()
      })
    }
    if (actions.includes('addCustomFields')) {
      _.assign(metaValidate, {
        customFields: Joi.array().items(Joi.object().keys({
          field: Joi.string().required(),
          value: Joi.string().required()
        })).min(1).required()
      })
    }
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      condition: Joi.string().valid('is', 'contains', 'startWith').required(),
      actions: Joi.array().items(
        Joi.string().valid('reply', 'addTag', 'addSubscription', 'addCustomFields').required()
      ).required(),
      meta: metaValidate,
      keywords: Joi.array().items(Joi.string().trim().required()).required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, keywords, condition, meta } = value
    const { messages } = meta
    function insertKeywords (meta) {
      return new Promise((resolve, reject) => {
        if (!_.isEmpty(meta.customFields)) {
          meta.customFields = meta.customFields.map(customField => {
            customField.field = _.lowerCase(customField.field)
            customField.value = _.lowerCase(customField.value)
            return customField
          })
        }
        const query = {
          customerId,
          isEnabled: true,
          condition,
          keywords,
          meta,
          actions,
          createdAt: moment().format()
        }
        new Keywords()
          .insertOne(query)
          .then(keyword => resolve(keyword))
          .catch(error => reject(error))
      })
    }
    messageBuilderDataOptimiser(customerId, messages)
      .then(messages => {
        if (!_.isEmpty(messages)) meta.messages = messages
        this.collectTagIds(customerId, meta)
          .then(meta => {
            insertKeywords(meta)
              .then(keyword => {
                this.collectRelatedData(customerId, keyword)
                  .then(keyword => res.json(keyword))
                  .catch(() => res.status(403).end())
              }).catch(() => res.status(403).end())
          }).catch(() => res.status(403).end())
      }).catch(error => res.status(422).json({ error: error.message }))
  }

  patch (req, res) {
    const data = req.body
    var metaValidate = {}
    if (data.actions.includes('reply')) {
      _.assign(metaValidate, {
        messages: Joi.array().items(Joi.object().keys({
          type: Joi.string().required(),
          data: Joi.string().required(),
          meta: Joi.string().optional().allow('')
        })).min(1).required()
      })
    }
    if (data.actions.includes('addSubscription')) _.assign(metaValidate, { sequenceId: Joi.string().required() })
    if (data.actions.includes('addTag')) {
      _.assign(metaValidate, {
        tags: Joi.array().items(Joi.string().trim().required()).required()
      })
    }
    if (data.actions.includes('addCustomFields')) {
      _.assign(metaValidate, {
        customFields: Joi.array().items(Joi.object().keys({
          field: Joi.string().required(),
          value: Joi.string().required()
        })).min(1).required()
      })
    }
    var schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      keywordId: Joi.string().required(),
      condition: Joi.string().valid('is', 'contains', 'startWith').required(),
      actions: Joi.array().items(
        Joi.string().valid('reply', 'addTag', 'addSubscription', 'addCustomFields').required()
      ).required(),
      meta: metaValidate,
      keywords: Joi.array().items(Joi.string().trim().required()).required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, keywordId, actions, condition, keywords, meta } = value
    const { messages } = meta
    function updateKeyword (messages) {
      if (!_.isEmpty(messages)) meta.messages = messages
      return new Promise((resolve, reject) => {
        if (!_.isEmpty(meta.customFields)) {
          meta.customFields = meta.customFields.map(customField => {
            customField.field = _.lowerCase(customField.field)
            customField.value = _.lowerCase(customField.value)
            return customField
          })
        }
        const query = { _id: ObjectId(keywordId), customerId }
        const data = { $set: { actions, condition, keywords, meta } }
        const options = { returnOriginal: false }
        new Keywords()
          .updateOne(query, data, options)
          .then(keyword => resolve(keyword))
          .catch(error => reject(error))
      })
    }
    messageBuilderDataOptimiser(customerId, messages)
      .then(messages => {
        this.collectTagIds(customerId, meta)
          .then(meta => {
            updateKeyword(messages)
              .then(keyword => {
                this.collectRelatedData(customerId, keyword)
                  .then(keyword => res.json(keyword))
                  .catch(() => res.status(403).end())
              }).catch(() => res.status(403).end())
          }).catch(() => res.status(403).end())
      }).catch(error => res.status(422).json({ error: error.message }))
  }
}

module.exports = KeywordsController
