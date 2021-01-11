const Joi = require('joi')
const moment = require('moment')
const shortId = require('shortid')
const ObjectId = require('mongodb').ObjectId
const Controller = require('./Controller')
const { formatJoiError } = require('../helpers')
const { Socket } = require('../services')
const { Teammates, Conversations, Mentions } = require('../model')

class MentionsController extends Controller {
  store (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.string().required(),
      contactId: Joi.string().required(),
      toTeammateId: Joi.string().required(),
      message: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, contactId, teammateId: fromId, toTeammateId: toId, message } = value
    function insertInternalConversation () {
      const data = {
        messageId: shortId.generate(),
        customerId,
        teammateId: fromId,
        contactId,
        message,
        type: 'chat',
        isFromTeammate: true,
        isInternal: true,
        createdAt: moment().format()
      }
      return new Conversations()
        .insertOne(data)
    }
    function insertMention (conversation) {
      const data = {
        customerId,
        contactId,
        conversationId: conversation._id.toString(),
        fromId,
        toId,
        createdAt: moment().format()
      }
      return new Mentions()
        .insertOne(data)
    }
    const collectToMentionTeammate = () => new Teammates().findOne({ _id: ObjectId(toId) })
    const collectFromMentionTeammate = () => new Teammates().findOne({ _id: ObjectId(fromId) })
    insertInternalConversation()
      .then(conversation => {
        Promise.all([insertMention(conversation), collectToMentionTeammate(), collectFromMentionTeammate()])
          .then(results => {
            conversation.toMentionTeammate = results[1]
            conversation.fromMentionTeammate = results[2]
            res.json(conversation)
            new Socket(customerId).channel('mentioned').emit(toId, conversation)
          }).catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }
}

module.exports = MentionsController
