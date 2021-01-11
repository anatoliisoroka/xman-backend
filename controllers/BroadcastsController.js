const _ = require('lodash')
const Joi = require('joi')
const moment = require('moment-timezone')
const Controller = require('./Controller')
const { Customers, Broadcasts, Contacts, ContactTags, CustomFields, BroadcastJobs } = require('../model')
const { Socket } = require('../services')
const { formatJoiError, messageBuilderDataOptimiser } = require('../helpers')

class BroadcastsController extends Controller {
  collectContacts (query, options) {
    return new Contacts()
      .find(query, options)
  }

  getAll (req, res) {
    const { customerId } = req.body
    new Broadcasts()
      .find({ customerId })
      .then(broadcasts => {
        broadcasts = _.orderBy(broadcasts, 'createdAt', 'desc')
        res.json(broadcasts)
      }).catch(() => res.status(403).end())
  }

  post (req, res) {
    const { body: data } = req
    const { targets } = data
    var targetsValidate = {}
    if (targets.includes('tags')) {
      _.assign(targetsValidate, {
        conditions: Joi.array().items({
          condition: Joi.string().required(),
          tagId: Joi.string().required()
        }).min(1).required()
      })
    }
    if (targets.includes('customFields')) {
      _.assign(targetsValidate, {
        customFields: Joi.array().items({
          field: Joi.string().required(),
          value: Joi.string().required()
        }).min(1).required()
      })
    }
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      targets: Joi.array().items(
        Joi.string().valid('tags', 'customFields').required()
      ).required(),
      ...targetsValidate,
      conditionType: Joi.string().required(),
      startAt: Joi.date().iso().required(),
      name: Joi.string().required(),
      messages: Joi.array().items({
        data: Joi.string().required(),
        type: Joi.string().required(),
        meta: Joi.string().optional().allow('')
      }).min(1).required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, name, conditions, customFields, messages, startAt, conditionType } = value
    function validateStartTime () {
      const isValidTime = moment(startAt).isAfter(moment())
      return isValidTime ? Promise.resolve() : Promise.reject(new Error())
    }
    function insertBroadcast (messages) {
      return new Promise((resolve, reject) => {
        const broadcast = {
          customerId,
          targets,
          messages,
          name,
          conditionType,
          startAt,
          report: {
            sent: 0,
            delivered: 0,
            viewed: 0,
            total: 0
          },
          createdAt: moment().format()
        }
        if (_.includes(targets, 'tags')) broadcast.conditions = conditions
        if (_.includes(targets, 'customFields')) broadcast.customFields = customFields
        new Broadcasts()
          .insertOne(broadcast)
          .then(result => resolve(result))
          .catch(error => reject(error))
      })
    }
    validateStartTime()
      .then(() => {
        messageBuilderDataOptimiser(customerId, messages)
          .then(messages => {
            insertBroadcast(messages)
              .then(broadcast => {
                this.createBroadcastJobs(broadcast)
                res.json(broadcast)
              }).catch(error => res.status(403).json(error))
          }).catch(error => res.status(422).json({ error: error.message }))
      }).catch(() => res.status(422).json({ error: 'invalid_start_time' }))
  }

  createBroadcastJobs (broadcast) {
    const { customerId, _id, messages, customFields, startAt } = broadcast
    const broadcastId = _id.toString()
    function insertBroadcastJob (customer, contact, message) {
      if (message.type === 'chat' && (_.includes(message.data, '{name}'))) {
        var templateMessage = Object.assign({}, message)
        templateMessage.data = _.replace(message.data, /{name}/g, contact.name)
      }
      const { whatsappApiUrl, whatsappApiToken, whatsappApiInstanceId } = customer
      const { whatsapp: phone } = contact
      const broadcastJob = {
        customerId,
        broadcastId,
        message: templateMessage || message,
        phone,
        whatsappApiUrl,
        whatsappApiToken,
        whatsappApiInstanceId,
        sendOn: moment(startAt).format(),
        isDelivered: false
      }
      return new BroadcastJobs()
        .insertOne(broadcastJob)
        .catch(() => {})
    }
    const collectContacts = () => {
      return new Promise((resolve, reject) => {
        const { conditions, conditionType } = broadcast
        const collectContactTags = () => new ContactTags().find({ customerId })
        const collectContacts = (tagsContactIds, customFieldsContactIds) => {
          tagsContactIds = _.isEmpty(tagsContactIds) ? customFieldsContactIds : tagsContactIds
          customFieldsContactIds = _.isEmpty(customFieldsContactIds) ? tagsContactIds : customFieldsContactIds
          var ids = _.intersection(tagsContactIds, customFieldsContactIds)
          ids = _.map(_.uniq(ids), id => super.oid(id))
          const query = {
            _id: { $in: ids },
            isBlocked: { $ne: true },
            isUnsubscribed: { $ne: true }
          }
          return this.collectContacts(query)
        }
        const updateBroadcastTotal = (contacts) => {
          const query = { _id: super.oid(broadcastId) }
          const update = { $set: { 'report.total': _.size(contacts) } }
          new Broadcasts()
            .updateOne(query, update)
            .then(() => {
              const payload = { broadcastId, target: _.size(contacts) }
              new Socket(customerId)
                .channel('updated:broadcast:target')
                .emit(customerId, payload)
            }).catch(() => {})
        }
        const collectAllContacts = () => {
          const query = {
            customerId,
            isBlocked: { $ne: true },
            isUnsubscribed: { $ne: true }
          }
          return this.collectContacts(query, null)
        }
        function collectCustomFields () {
          return new Promise((resolve, reject) => {
            if (_.isEmpty(customFields)) return resolve([])
            function collectCustomField (customField) {
              return new CustomFields()
                .find({ customerId, field: customField.field, value: customField.value })
            }
            const collectAll = () => customFields.map(customField => collectCustomField(customField))
            Promise.all(collectAll())
              .then(fields => {
                fields = _.flatten(fields)
                resolve(fields)
              }).catch(error => reject(error))
          })
        }
        Promise.all([collectContactTags(), collectAllContacts(), collectCustomFields()])
          .then(result => {
            const [contactTags, contacts, allCustomFields] = result
            function filterConditionType (contacts) {
              const isTags = _.filter(conditions, { condition: 'is' }).map(condition => condition.tagId)
              const isntTags = _.filter(conditions, { condition: 'isnt' }).map(condition => condition.tagId)
              const isConditionAll = (conditionType === 'all')
              const isConditionAny = (conditionType === 'any')
              const allContactIds = contacts.map(contact => contact._id.toString())
              const isTagsContactIds = isTags.map(isTag => {
                return _.filter(contactTags, contactTag => _.includes(contactTag, isTag))
                  .map(contactTag => contactTag.contactId)
              })
              const isntTagsContactIds = isntTags.map(isntTag => {
                return _.filter(contactTags, contactTag => _.includes(contactTag, isntTag))
                  .map(contactTag => contactTag.contactId)
              })
              const hasNoIsContacts = !isTagsContactIds.length
              const hasNoIsntConatcts = !isntTagsContactIds.length
              const hasIsAndIsntContacts = isTagsContactIds.length && isntTagsContactIds.length
              if (isConditionAll && hasNoIsntConatcts) {
                return _.intersection(...isTagsContactIds)
              } else if (isConditionAny && hasNoIsntConatcts) {
                return _.union(...isTagsContactIds)
              } else if (isConditionAll && hasNoIsContacts) {
                return _.difference(allContactIds, _.union(...isntTagsContactIds))
              } else if (isConditionAny && hasNoIsContacts) {
                return _.difference(allContactIds, _.intersection(...isntTagsContactIds))
              } else if (isConditionAll && hasIsAndIsntContacts) {
                return _.difference(_.flatten(isTagsContactIds), _.flatten(isntTagsContactIds))
              } else if (isConditionAny && hasIsAndIsntContacts) {
                return _.union(_.flatten(isTagsContactIds), _.difference(allContactIds, _.flatten(isntTagsContactIds)))
              }
            }
            function filterCustomFieldsContacts (contacts) {
              const allContactIds = contacts.map(contact => contact._id.toString())
              var contactIds = allCustomFields.map(customField => customField.contactId)
              contactIds = _.uniq(contactIds)
              contactIds = _.intersection(allContactIds, contactIds)
              return contactIds
            }
            Promise.all([collectContacts(filterConditionType(contacts), filterCustomFieldsContacts(contacts))])
              .then(results => {
                const contacts = results[0]
                updateBroadcastTotal(contacts)
                resolve(contacts)
              }).catch(error => reject(error))
          }).catch(error => reject(error))
      })
    }
    new Customers()
      .findOne({ _id: super.oid(customerId) })
      .then(customer => {
        collectContacts(customer)
          .then(contacts => {
            contacts.forEach(contact => {
              messages.forEach(message => {
                insertBroadcastJob(customer, contact, message)
              })
            })
          }).catch(() => {})
      }).catch(() => {})
  }

  bulkDelete (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      broadcastIds: Joi.array().items(Joi.string().trim().required()).min(1).required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, broadcastIds } = value
    const deleteBroadcasts = () => {
      const deleteBroadcast = (broadcastId) => {
        return new Promise((resolve, reject) => {
          const query = { customerId, _id: super.oid(broadcastId) }
          new Broadcasts()
            .deleteOne(query)
            .then(result => resolve(result))
            .catch(error => reject(error))
        })
      }
      const deleteAllBroadcasts = () => broadcastIds.map(broadcastId => deleteBroadcast(broadcastId))
      return Promise.all(deleteAllBroadcasts())
    }
    function deleteBroadcastsJobs (broadcasts) {
      function deleteBroadcastJobs (broadcast) {
        const broadcastId = broadcast._id.toString()
        return new BroadcastJobs()
          .deleteMany({ customerId, broadcastId })
      }
      const deleteAllBroadcastJobs = () => broadcasts.map(broadcast => deleteBroadcastJobs(broadcast))
      return Promise.all(deleteAllBroadcastJobs())
    }
    deleteBroadcasts()
      .then(broadcasts => {
        deleteBroadcastsJobs(broadcasts)
          .then(() => res.status(200).end())
          .catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }
}

module.exports = BroadcastsController
