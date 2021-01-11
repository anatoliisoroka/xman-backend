const Joi = require('joi')
const bcrypt = require('bcryptjs')
const _ = require('lodash')
const moment = require('moment')
const shortId = require('shortid')
const { ObjectId } = require('mongodb')
const Controller = require('./Controller')
const { Storage } = require('../services')
const { formatJoiError } = require('../helpers')
const { Customers,
  Teammates,
  AssignmentRules,
  Contacts,
  Conversations,
  ContactRemarks,
  ContactTags,
  GroupConversations,
  Mentions } = require('../model')

class TeammatesController extends Controller {
  collectTeammate (query) {
    return new Teammates()
      .findOne(query)
  }

  collectTeammates (query, options) {
    return new Teammates()
      .find(query, options)
  }

  updateTeammate (query, data, options) {
    return new Teammates()
      .updateOne(query, data, options)
  }

  updateAssignmentRules (query, data) {
    return new AssignmentRules()
      .updateMany(query, data)
  }

  updateConversations (query, data) {
    return new Conversations()
      .updateMany(query, data)
  }

  updateGroupConversations (query, data) {
    return new GroupConversations()
      .updateMany(query, data)
  }

  updateMentions (query, data) {
    return new Mentions()
      .updateMany(query, data)
  }

  getOne (req, res) {
    const { query: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      id: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, id } = value
    const query = { customerId, _id: super.oid(id) }
    this.collectTeammate(query)
      .then(teammate => res.json(teammate))
      .catch(() => res.status(403).end())
  }

  getAll (req, res) {
    const { customerId } = req.body
    const query = { customerId, isCustomer: false }
    const options = { projection: { password: false } }
    this.collectTeammates(query, options)
      .then(teammates => {
        teammates = _.orderBy(teammates, 'createdAt', 'desc')
        res.json(teammates)
      }).catch(() => res.status(403).end())
  }

  getAllWithCustomer (req, res) {
    const { customerId } = req.body
    const query = { customerId }
    const options = { projection: { password: false } }
    this.collectTeammates(query, options)
      .then(teammates => {
        teammates = _.orderBy(teammates, 'createdAt', 'desc')
        res.json(teammates)
      }).catch(() => res.status(403).end())
  }

  switchAvailability (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      isAvailable: Joi.boolean().required(),
      id: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, id, isAvailable } = value
    const query = { customerId, _id: super.oid(id) }
    const update = { $set: { isAvailable } }
    const options = { returnOriginal: false }
    this.updateTeammate(query, update, options)
      .then(teammate => res.json(teammate))
      .catch(() => res.status(403).end())
  }

  put (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      name: Joi.string().required(),
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
      photo: Joi.string().dataUri().allow('')
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, name, email, password, photo } = value
    function insertTeammate (image) {
      const data = {
        customerId,
        name,
        email,
        password: bcrypt.hashSync(password, 10),
        isAvailable: false,
        photo: image,
        isCustomer: false,
        createdAt: moment().format()
      }
      return new Teammates()
        .insertOne(data)
    }
    const addTeammate = (image) => {
      function checkCustomerExistance () {
        const query = { email }
        return new Customers()
          .find(query)
      }
      const checkTeammateExistance = () => {
        const query = { customerId, email }
        return this.collectTeammates(query)
      }
      Promise.all([checkCustomerExistance(), checkTeammateExistance()])
        .then(results => {
          const isExistCustomer = results[0].length
          const isExistTeammate = results[1].length
          const isExistUser = isExistCustomer || isExistTeammate
          if (isExistUser) return res.status(422).json({ error: 'email_is_already_exists' })
          insertTeammate(image)
            .then(teammate => {
              delete teammate.password
              res.json(teammate)
            }).catch(() => res.status(403).end())
        }).catch(() => res.status(403).end())
    }
    const isPhotoDataUri = _.startsWith(photo, 'data:')
    if (isPhotoDataUri) {
      const uniqId = shortId.generate()
      const filepath = `images/${customerId}/${uniqId}.jpeg`
      const mimeType = 'image/jpeg'
      new Storage().put(photo, filepath, mimeType)
        .then(image => addTeammate(image))
        .catch(() => res.status(403).end())
    } else addTeammate()
  }

  patch (req, res) {
    const { body: data, params: { id } } = req
    var schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      name: Joi.string().required(),
      email: Joi.string().email().required(),
      password: Joi.string().optional().min(6).allow(''),
      photo: Joi.string().dataUri().allow('')
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, name, email, password, photo } = value
    const checkTeammateExistance = () => {
      const query = { customerId, email, _id: { $ne: ObjectId(id) } }
      return this.collectTeammates(query)
    }
    const patchTeammate = (photo) => {
      return new Promise((resolve, reject) => {
        const teammate = { name, email }
        if (password) teammate.password = bcrypt.hashSync(password, 10)
        if (photo) teammate.photo = photo
        checkTeammateExistance()
          .then(existance => {
            const isExistTeammate = existance.length
            if (isExistTeammate) return res.status(422).json({ error: 'email_already_exists' })
            const query = { _id: super.oid(id), customerId }
            const update = { $set: teammate }
            const options = { returnOriginal: false }
            this.updateTeammate(query, update, options)
              .then(teammate => {
                delete teammate.password
                resolve(teammate)
              }).catch(error => reject(error))
          }).catch(error => reject(error))
      })
    }
    function storePhoto () {
      return new Promise((resolve, reject) => {
        const isPhotoDataUri = _.startsWith(photo, 'data:')
        if (!isPhotoDataUri) return resolve(photo)
        const uniqId = shortId.generate()
        const filepath = `images/${customerId}/${uniqId}.jpeg`
        const mimeType = 'image/jpeg'
        new Storage().put(photo, filepath, mimeType)
          .then(image => resolve(image))
          .catch(error => reject(error))
      })
    }
    storePhoto()
      .then(image => {
        patchTeammate(image)
          .then(teammate => res.json(teammate))
          .catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  delete (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      deleteTeammateId: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, deleteTeammateId, teammateId: signedTeammateId } = value
    if (signedTeammateId === deleteTeammateId) return res.status(422).json({ error: 'permission_denied' })
    const updateConversationsTeammateId = (teammateId) => {
      const query = { teammateId: deleteTeammateId }
      const data = { $set: { teammateId } }
      return this.updateConversations(query, data)
    }
    const updateConversationsSenderId = (senderId) => {
      const query = { senderId: deleteTeammateId }
      const data = { $set: { senderId } }
      return this.updateConversations(query, data)
    }
    const updateAssignmentRulesAssigneeId = (assigneeId) => {
      const query = { assigneeId: deleteTeammateId }
      const data = { $set: { assigneeId } }
      return this.updateAssignmentRules(query, data)
    }
    const updateAssignmentRulesValue = value => {
      const query = { value: deleteTeammateId }
      const data = { $set: { value } }
      return this.updateAssignmentRules(query, data)
    }
    const updateGroupConversationsTeammateId = teammateId => {
      const query = { teammateId: deleteTeammateId }
      const data = { $set: { teammateId } }
      return this.updateGroupConversations(query, data)
    }
    const updateGroupConversationsSenderId = senderId => {
      const query = { senderId: deleteTeammateId }
      const data = { $set: { senderId } }
      return this.updateGroupConversations(query, data)
    }
    const updateMentionsFromId = fromId => {
      const query = { fromId: deleteTeammateId }
      const data = { $set: { fromId } }
      return this.updateMentions(query, data)
    }
    const updateMentionsToId = toId => {
      const query = { toId: deleteTeammateId }
      const data = { $set: { toId } }
      return this.updateMentions(query, data)
    }
    const updateContactsTeammateId = teammateId => {
      const query = { teammateId: deleteTeammateId }
      const data = { $set: { teammateId } }
      return new Contacts()
        .updateMany(query, data)
    }
    const updateContactTagsTeammateId = teammateId => {
      const query = { teammateId: deleteTeammateId }
      const data = { $set: { teammateId } }
      return new ContactTags()
        .updateMany(query, data)
    }
    const updateContactRemarksTeammateId = teammateId => {
      const query = { teammateId: deleteTeammateId }
      const data = { $set: { teammateId } }
      return new ContactRemarks()
        .updateMany(query, data)
    }
    const deleteTeammate = () => {
      const query = { _id: super.oid(deleteTeammateId), customerId }
      return new Teammates()
        .deleteOne(query)
    }
    const query = { customerId, isCustomer: true }
    this.collectTeammate(query)
      .then(teammate => {
        const customerTeammateId = teammate._id.toString()
        Promise.all([
          updateConversationsTeammateId(customerTeammateId),
          updateConversationsSenderId(customerTeammateId),
          updateAssignmentRulesAssigneeId(customerTeammateId),
          updateAssignmentRulesValue(customerTeammateId),
          updateGroupConversationsTeammateId(customerTeammateId),
          updateGroupConversationsSenderId(customerTeammateId),
          updateMentionsFromId(customerTeammateId),
          updateMentionsToId(customerTeammateId),
          updateContactsTeammateId(customerTeammateId),
          updateContactTagsTeammateId(customerTeammateId),
          updateContactRemarksTeammateId(customerTeammateId)])
          .then(() => {
            deleteTeammate()
              .then(() => res.json(true))
              .catch(() => res.status(403).end())
          }).catch(() => res.status(403).end())
      })
  }
}

module.exports = TeammatesController
