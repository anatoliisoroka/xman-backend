const _ = require('lodash')
const Joi = require('joi')
const moment = require('moment')
const Fuse = require('fuse.js')
const ObjectId = require('mongodb').ObjectId
const shortId = require('shortid')
const wavToOga = require('wav-oga-opus-converter')
const Controller = require('./Controller')
const {
  formatJoiError,
  isURL,
  previewParser,
  isValidWhatsappFileSize,
  paginate
} = require('../helpers')
const { Customers, Teammates, Contacts, GroupConversations, Groups } = require('../model')
const { Socket, Storage, ChatApi } = require('../services')
require('dotenv').config()

class GroupConversationsController extends Controller {
  collectGroupConversations (query, options) {
    return new GroupConversations().find(query, options)
  }

  insertConversation (data) {
    return new GroupConversations().insertOne(data)
  }

  collectCustomer (query, options) {
    return new Customers().findOne(query, options)
  }

  collectTeammate (query, options) {
    return new Teammates().findOne(query, options)
  }

  collectContact (query, options) {
    return new Contacts().findOne(query, options)
  }

  get (req, res) {
    const { groupId } = req.params
    const { from } = req.query
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      groupId: Joi.string().required(),
      from: Joi.string().required()
    }
    var data = req.body
    data.groupId = groupId
    data.from = from
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId } = value
    const collectSender = (conversation) => {
      return new Promise((resolve, reject) => {
        const { senderId } = conversation
        if (conversation.isFromTeammate) {
          if (!senderId) return resolve(conversation)
          this.collectTeammate({ _id: ObjectId(senderId) })
            .then(teammate => {
              const { name } = teammate
              conversation.senderName = name
              resolve(conversation)
            }).catch(error => reject(error))
        } else {
          this.collectContact({ _id: ObjectId(conversation.contactId) })
            .then(contact => {
              conversation.contact = contact
              resolve(conversation)
            }).catch(error => reject(error))
        }
      })
    }
    Promise.all([this.collectGroupConversations({ customerId, groupId })])
      .then(results => {
        var groupConversations = results[0]
        groupConversations = _.orderBy(groupConversations, 'createdAt', 'desc')
        const collectSenders = () => groupConversations.map(conv => collectSender(conv))
        Promise.all(collectSenders())
          .then(groupConversations => {
            groupConversations = paginate(groupConversations, from)
            res.json(groupConversations)
          }).catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  search (req, res) {
    const { groupId } = req.params
    const { from, keyword } = req.query
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      groupId: Joi.string().required(),
      from: Joi.string().required()
    }
    var data = req.body
    data.groupId = groupId
    data.from = from
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId } = value
    const collectSender = (conversation) => {
      return new Promise((resolve, reject) => {
        const { senderId } = conversation
        if (conversation.isFromTeammate) {
          if (!senderId) return resolve(conversation)
          this.collectTeammate({ _id: ObjectId(senderId) })
            .then(teammate => {
              const { name } = teammate
              conversation.senderName = name
              resolve(conversation)
            }).catch(error => reject(error))
        } else {
          this.collectContact({ _id: ObjectId(conversation.contactId) })
            .then(contact => {
              conversation.contact = contact
              resolve(conversation)
            }).catch(error => reject(error))
        }
      })
    }
    Promise.all([this.collectGroupConversations({ customerId, groupId })])
      .then(results => {
        var groupConversations = results[0]
        groupConversations = _.orderBy(groupConversations, 'createdAt', 'desc')
        const fuse = new Fuse(groupConversations, { threshold: 0.4, keys: ['message', 'caption', 'fileName'] })
        groupConversations = fuse.search(keyword)
        const collectSenders = () => groupConversations.map(conv => collectSender(conv))
        Promise.all(collectSenders())
          .then(groupConversations => {
            groupConversations = paginate(groupConversations, from)
            res.json(groupConversations)
          }).catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  store (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.string().required(),
      groupId: Joi.string().required(),
      chatId: Joi.string().required(),
      message: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, groupId, chatId, message, teammateId } = value
    function send (customer) {
      function sendText () {
        const payload = {
          chatId,
          body: message
        }
        return new ChatApi(customer.whatsappApiUrl, customer.whatsappApiToken).send().text(payload)
      }
      function sendLink () {
        return new Promise((resolve, reject) => {
          previewParser(message)
            .then(preview => {
              const payload = {
                chatId,
                body: message,
                previewBase64: preview.image,
                title: preview.title,
                description: preview.description
              }
              new ChatApi(customer.whatsappApiUrl, customer.whatsappApiToken).send().link(payload)
                .then(response => resolve(response))
                .catch(error => reject(error))
            }).catch(() => {
              sendText()
                .then(response => resolve(response))
                .catch(error => reject(error))
            })
        })
      }
      return isURL(message) ? sendLink() : sendText()
    }
    const insertConversation = (messageId) => {
      return this.insertConversation({
        customerId,
        teammateId,
        groupId,
        message,
        messageId,
        senderId: teammateId,
        type: 'chat',
        createdAt: moment().format(),
        isFromTeammate: true
      })
    }
    this.collectCustomer({ _id: ObjectId(customerId) }, null)
      .then(customer => {
        if (_.isEmpty(customer)) throw new Error()
        send(customer)
          .then(response => {
            const messageId = response.data.id
            insertConversation(messageId)
              .then(conversation => {
                const { data } = response
                res.json(data)
                setTimeout(() => new Socket(customerId).channel('created:conversation').emit(customerId, conversation), 300)
                setTimeout(() => new Socket(customerId).channel('created:conversation').emit(groupId, conversation), 300)
              }).catch(() => res.status(403).end())
          }).catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  sendFile (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      senderId: Joi.string().required(),
      teammateId: Joi.string().required(),
      message: Joi.string().required(),
      fileName: Joi.string().required(),
      groupId: Joi.string().required(),
      chatId: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, senderId, teammateId, message, fileName, groupId, chatId } = value
    function send (customer, body) {
      const payload = {
        chatId,
        body,
        filename: fileName
      }
      return new ChatApi(customer.whatsappApiUrl, customer.whatsappApiToken).send().file(payload)
    }
    const insertConversation = (messageId, url) => {
      return this.insertConversation({
        customerId,
        teammateId,
        groupId,
        message: url,
        messageId,
        senderId,
        type: 'document',
        createdAt: moment().format(),
        isFromTeammate: true,
        fileName
      })
    }
    this.collectCustomer({ _id: ObjectId(customerId) }, null)
      .then(customer => {
        if (_.isEmpty(customer)) throw new Error()
        const extension = _.last(fileName.split('.'))
        const uniqId = shortId.generate()
        const filepath = `files/${customerId}/${uniqId}.${extension}`
        const mimeType = `application/${extension}`
        new Storage().put(message, filepath, mimeType)
          .then(url => {
            send(customer, url)
              .then(response => {
                const messageId = response.data.id
                insertConversation(messageId, url)
                  .then(conversation => {
                    const { data } = response
                    res.json(data)
                    setTimeout(() => new Socket(customerId).channel('created:conversation').emit(customerId, conversation), 300)
                    setTimeout(() => new Socket(customerId).channel('created:conversation').emit(groupId, conversation), 300)
                  }).catch(() => res.status(403).end())
              }).catch(() => res.status(403).end())
          }).catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  sendImage (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      senderId: Joi.string().required(),
      teammateId: Joi.string().required(),
      message: Joi.string().required(),
      fileName: Joi.string().required(),
      groupId: Joi.string().required(),
      chatId: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, chatId, senderId, teammateId, message, fileName, groupId } = value
    if (!isValidWhatsappFileSize(message)) return res.status(422).json({ error: 'photo_size_is_too_large' })
    function send (customer, resizedPhoto) {
      const payload = {
        chatId,
        body: resizedPhoto,
        filename: fileName
      }
      return new ChatApi(customer.whatsappApiUrl, customer.whatsappApiToken).send().file(payload)
    }
    const insertConversation = (messageId, image) => {
      return this.insertConversation({
        customerId,
        teammateId,
        groupId,
        message: image,
        messageId,
        senderId,
        type: 'image',
        createdAt: moment().format(),
        isFromTeammate: true
      })
    }
    Promise.all([this.collectCustomer({ _id: ObjectId(customerId) }, null)])
      .then(results => {
        const customer = results[0]
        if (_.isEmpty(customer)) throw new Error()
        const extension = _.last(fileName.split('.'))
        const uniqId = shortId.generate()
        const filepath = `images/${customerId}/${uniqId}.${extension}`
        const mimeType = 'image/jpeg'
        new Storage().put(message, filepath, mimeType)
          .then(image => {
            send(customer, image)
              .then(response => {
                const messageId = response.data.id
                insertConversation(messageId, image)
                  .then(conversation => {
                    const { data } = response
                    res.json(data)
                    setTimeout(() => new Socket(customerId).channel('created:conversation').emit(customerId, conversation), 300)
                    setTimeout(() => new Socket(customerId).channel('created:conversation').emit(groupId, conversation), 300)
                  }).catch(() => res.status(403).end())
              }).catch(() => res.status(403).end())
          }).catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  sendVoice (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.string().required(),
      senderId: Joi.string().required(),
      groupId: Joi.string().required(),
      chatId: Joi.string().required(),
      message: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, senderId, teammateId, message, groupId, chatId } = value
    const insertConversation = (messageId, audio) => {
      return this.insertConversation({
        customerId,
        teammateId,
        message: audio,
        groupId,
        messageId,
        senderId,
        type: 'ptt',
        createdAt: moment().format(),
        isFromTeammate: true
      })
    }
    const uid = shortId.generate()
    const filepath = `voice-messages/${customerId}/${uid}.oga`
    const mimeType = 'audio/oga'
    function encodeOpus () {
      return new Promise((resolve, reject) => {
        wavToOga(message)
          .then(oga => {
            new Storage().put(oga, filepath, mimeType)
              .then(url => resolve(url))
              .catch(error => reject(error))
          }).catch(error => reject(error))
      })
    }
    Promise.all([this.collectCustomer({ _id: ObjectId(customerId) }, null), encodeOpus()])
      .then(result => {
        const customer = result[0]
        const audio = result[1]
        const payload = {
          chatId,
          audio
        }
        new ChatApi(customer.whatsappApiUrl, customer.whatsappApiToken).send().ptt(payload)
          .then(response => {
            const { id: messageId } = response.data
            insertConversation(messageId, audio)
              .then(conversation => {
                const { data } = response
                res.json(data)
                setTimeout(() => new Socket(customerId).channel('created:conversation').emit(customerId, conversation), 300)
                setTimeout(() => new Socket(customerId).channel('created:conversation').emit(groupId, conversation), 300)
              }).catch(() => res.status(403).end())
          }).catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  sendLocation (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      chatId: Joi.string().required(),
      lat: Joi.number().required(),
      lng: Joi.number().required(),
      address: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, chatId, lat, lng, address } = value
    function send (customer) {
      const { whatsappApiInstanceId, whatsappApiToken } = customer
      var payload = {
        chatId,
        lat,
        lng,
        address
      }
      return new ChatApi(null, whatsappApiToken).send().location(whatsappApiInstanceId, payload)
    }
    this.collectCustomer({ _id: ObjectId(customerId) }, null)
      .then(customer => {
        send(customer)
          .then(result => res.json(result.data))
          .catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  share (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      whatsappGroupId: Joi.string().required(),
      vcard: Joi.object().keys({
        name: Joi.string().required(),
        phone: Joi.number().required()
      })
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, whatsappGroupId: chatId, vcard: { name: firstName, phone } } = value
    this.collectCustomer({ _id: ObjectId(customerId) }, null)
      .then(customer => {
        const { whatsappApiInstanceId, whatsappApiToken } = customer
        const payload = {
          chatId,
          vcard: {
            firstName,
            lastName: ' ',
            phone
          }
        }
        return new ChatApi(null, whatsappApiToken).send().vcard(payload, whatsappApiInstanceId)
          .then(result => res.json(result.data))
          .catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  readAll (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      groupId: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, groupId } = value
    const updateGroup = () => new Groups().updateOne({ _id: ObjectId(groupId) }, { $set: { 'lastConversation.unreads': 0 } })
    const updateConversations = () => {
      return new GroupConversations()
        .updateMany({
          customerId,
          groupId,
          isFromTeammate: false,
          isRead: { $ne: true } },
        { $set: { isRead: true } })
    }
    const readChat = (whatsappApiUrl, whatsappApiToken, payload) => {
      return new ChatApi(whatsappApiUrl, whatsappApiToken).readChat(payload)
    }
    Promise.all([this.collectCustomer({ _id: ObjectId(customerId) }, null), updateGroup()])
      .then(results => {
        const customer = results[0]
        const group = results[1]
        const payload = {
          chatId: group.whatsappGroupId
        }
        readChat(customer.whatsappApiUrl, customer.whatsappApiToken, payload)
        updateConversations()
          .then(() => res.json(true))
          .catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }
}

module.exports = GroupConversationsController
