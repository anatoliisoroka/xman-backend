
const Joi = require('joi')
const ObjectId = require('mongodb').ObjectId
const { formatJoiError } = require('../helpers')
const Controller = require('./Controller')
const { Contacts, GroupParticipants, Groups } = require('../model')

class GroupsController extends Controller {
  get (req, res) {
    const { groupId } = req.params
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      groupId: Joi.string().required()
    }
    var data = req.body
    data.groupId = groupId
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId } = value
    const query = { customerId, _id: ObjectId(groupId) }
    new Groups().findOne(query)
      .then(group => {
        group.isGroup = true
        res.json(group)
      }).catch(() => res.status(403).end())
  }

  updateName (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      groupId: Joi.string().required(),
      name: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { groupId, name } = value
    function updateContactName () {
      const query = { _id: ObjectId(groupId) }
      const data = { $set: { name, isRenamed: true } }
      return new Groups().updateOne(query, data)
    }
    updateContactName()
      .then(() => res.status(200).end())
      .catch(() => res.status(403).end())
  }

  participants (req, res) {
    const { groupId } = req.params
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      groupId: Joi.string().required()
    }
    var data = req.body
    data.groupId = groupId
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId } = value
    const collectParticipants = () => new GroupParticipants().find({ customerId, groupId })
    collectParticipants()
      .then(participants => {
        const collectContact = contactId => new Contacts().findOne({ customerId, _id: ObjectId(contactId) })
        const collectContacts = () => participants.map(participant => collectContact(participant.contactId))
        Promise.all(collectContacts())
          .then(contacts => res.json(contacts))
          .catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }
}

module.exports = GroupsController
