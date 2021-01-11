const _ = require('lodash')
const Joi = require('joi')
const moment = require('moment')
const shortId = require('shortid')
const Fuse = require('fuse.js')
const ObjectId = require('mongodb').ObjectId
const randomColor = require('randomcolor')
const wavToOga = require('wav-oga-opus-converter')
const {
  formatJoiError,
  isURL,
  previewParser,
  isValidWhatsappFileSize,
  paginate
} = require('../helpers')
const Controller = require('./Controller')
const { Customers, Teammates, Contacts, Conversations, Mentions } = require('../model')
const { Socket, Storage, ChatApi } = require('../services')
require('dotenv').config()

class ConversationsController extends Controller {
  collectCustomer (query) {
    return new Customers().findOne(query)
  }

  collectTeammates (query) {
    return new Teammates().find(query)
  }

  collectTeammate (query) {
    return new Teammates().findOne(query)
  }

  collectContact (query) {
    return new Contacts().findOne(query)
  }

  collectConversations (query) {
    return new Conversations().find(query)
  }

  insertConversation (data) {
    return new Conversations().insertOne(data)
  }

  collectMentions (query) {
    return new Mentions().find(query)
  }

  get (req, res) {
    const { from } = req.query
    const customerId = req.body.customerId
    const contactId = req.params.contactId
    const collectConversations = () => this.collectConversations({ customerId, contactId })
    const collectMentions = () => this.collectMentions({ customerId })
    const collectTeammates = () => this.collectTeammates({ customerId })
    const collectSender = (conversation) => {
      return new Promise((resolve, reject) => {
        const { senderId } = conversation
        if (!senderId) return resolve(conversation)
        this.collectTeammate({ _id: ObjectId(senderId) })
          .then(teammate => {
            const { name } = teammate
            conversation.senderName = name
            resolve(conversation)
          }).catch(error => reject(error))
      })
    }
    Promise.all([collectConversations(), collectMentions(), collectTeammates()])
      .then(results => {
        var conversations = results[0]
        const mentions = results[1]
        const teammates = results[2]
        conversations = _.orderBy(conversations, 'createdAt', 'desc')
        conversations = conversations.map(conversation => {
          const mention = _.find(mentions, { conversationId: conversation._id.toString() })
          if (mention) {
            conversation.toMentionTeammate = _.find(teammates, { _id: ObjectId(mention.toId) })
            conversation.fromMentionTeammate = _.find(teammates, { _id: ObjectId(mention.fromId) })
            return conversation
          }
          return conversation
        })
        const collectSenders = () => conversations.map(conv => collectSender(conv))
        Promise.all(collectSenders())
          .then(conversations => {
            conversations = paginate(conversations, from)
            res.json(conversations)
          }).catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  search (req, res) {
    const { from, keyword } = req.query
    const customerId = req.body.customerId
    const contactId = req.params.contactId
    const collectConversations = () => this.collectConversations({ customerId, contactId })
    const collectMentions = () => this.collectMentions({ customerId })
    const collectTeammates = () => this.collectTeammates({ customerId })
    const collectSender = (conversation) => {
      return new Promise((resolve, reject) => {
        const { senderId } = conversation
        if (!senderId) return resolve(conversation)
        this.collectTeammate({ _id: ObjectId(senderId) })
          .then(teammate => {
            const { name } = teammate
            conversation.senderName = name
            resolve(conversation)
          }).catch(error => reject(error))
      })
    }
    Promise.all([collectConversations(), collectMentions(), collectTeammates()])
      .then(results => {
        var conversations = results[0]
        const mentions = results[1]
        const teammates = results[2]
        conversations = _.orderBy(conversations, 'createdAt', 'desc')
        const fuse = new Fuse(conversations, { threshold: 0.4, keys: ['message', 'caption', 'fileName'] })
        conversations = fuse.search(keyword)
        conversations = conversations.map(conversation => {
          const mention = _.find(mentions, { conversationId: conversation._id.toString() })
          if (mention) {
            conversation.toMentionTeammate = _.find(teammates, { _id: ObjectId(mention.toId) })
            conversation.fromMentionTeammate = _.find(teammates, { _id: ObjectId(mention.fromId) })
            return conversation
          }
          return conversation
        })
        const collectSenders = () => conversations.map(conv => collectSender(conv))
        Promise.all(collectSenders())
          .then(conversations => {
            conversations = paginate(conversations, from)
            res.json(conversations)
          }).catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  store (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.string().required(),
      contactId: Joi.string().required(),
      message: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, contactId, message, teammateId, teammateId: senderId } = value
    const collectCustomer = () => this.collectCustomer({ _id: ObjectId(customerId) })
    const collectContact = () => this.collectContact({ _id: ObjectId(contactId) })
    function send (customer, contact) {
      function sendText () {
        const payload = {
          phone: contact.whatsapp,
          body: message
        }
        return new ChatApi(customer.whatsappApiUrl, customer.whatsappApiToken).send().text(payload)
      }
      function sendLink () {
        return new Promise((resolve, reject) => {
          previewParser(message)
            .then(preview => {
              const payload = {
                phone: contact.whatsapp,
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
        contactId,
        message,
        messageId,
        senderId,
        type: 'chat',
        createdAt: moment().format(),
        isFromTeammate: true
      })
    }
    Promise.all([collectCustomer(), collectContact()])
      .then(results => {
        const customer = results[0]
        const contact = results[1]
        if (_.isEmpty(customer) || _.isEmpty(contact)) throw new Error()
        send(customer, contact)
          .then(response => {
            const messageId = response.data.id
            insertConversation(messageId)
              .then(conversation => {
                const { data } = response
                res.json(data)
                setTimeout(() => new Socket(customerId).channel('created:conversation').emit(customerId, conversation), 300)
                setTimeout(() => new Socket(customerId).channel('created:conversation').emit(contactId, conversation), 300)
              }).catch(() => res.status(403).end())
          }).catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  sendVoice (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.string().required(),
      contactId: Joi.string().required(),
      message: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, teammateId: senderId, teammateId, message, contactId } = value
    const collectCustomer = () => this.collectCustomer({ _id: ObjectId(customerId) })
    const collectContact = () => this.collectContact({ _id: ObjectId(contactId) })
    const insertConversation = (messageId, audio) => {
      return this.insertConversation({
        customerId,
        teammateId,
        contactId,
        message: audio,
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
    Promise.all([collectCustomer(), collectContact(), encodeOpus()])
      .then(result => {
        const customer = result[0]
        const contact = result[1]
        const audio = result[2]
        const payload = {
          phone: contact.whatsapp,
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
                setTimeout(() => new Socket(customerId).channel('created:conversation').emit(contactId, conversation), 400)
              }).catch(() => res.status(403).end())
          }).catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  sendImage (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.string().required(),
      contactId: Joi.string().required(),
      message: Joi.string().required(),
      fileName: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, teammateId: senderId, teammateId, contactId, message, fileName } = value
    if (!isValidWhatsappFileSize(message)) return res.status(422).json({ error: 'photo_size_is_too_large' })
    const collectCustomer = () => this.collectCustomer({ _id: ObjectId(customerId) })
    const collectContact = () => this.collectContact({ _id: ObjectId(contactId) })
    function send (customer, contact, resizedPhoto) {
      const payload = {
        phone: contact.whatsapp,
        body: resizedPhoto,
        filename: fileName
      }
      return new ChatApi(customer.whatsappApiUrl, customer.whatsappApiToken).send().file(payload)
    }
    const insertConversation = (messageId, image) => {
      return this.insertConversation({
        customerId,
        teammateId,
        contactId,
        message: image,
        messageId,
        senderId,
        type: 'image',
        createdAt: moment().format(),
        isFromTeammate: true
      })
    }
    Promise.all([collectCustomer(), collectContact()])
      .then(results => {
        const customer = results[0]
        const contact = results[1]
        if (_.isEmpty(customer) || _.isEmpty(contact)) throw new Error()
        const extension = _.last(fileName.split('.'))
        const uniqId = shortId.generate()
        const filepath = `images/${customerId}/${uniqId}.${extension}`
        const mimeType = 'image/jpeg'
        new Storage().put(message, filepath, mimeType)
          .then(image => {
            send(customer, contact, image)
              .then(response => {
                const messageId = response.data.id
                insertConversation(messageId, image)
                  .then(conversation => {
                    const { data } = response
                    res.json(data)
                    setTimeout(() => new Socket(customerId).channel('created:conversation').emit(customerId, conversation), 300)
                    setTimeout(() => new Socket(customerId).channel('created:conversation').emit(contactId, conversation), 300)
                  }).catch(() => res.status(403).end())
              }).catch(() => res.status(403).end())
          }).catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  forward (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      messageId: Joi.string().required(),
      phone: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, messageId, phone } = value
    this.collectCustomer({ _id: ObjectId(customerId) })
      .then(customer => {
        const { whatsappApiUrl, whatsappApiToken } = customer
        const payload = { phone, messageId }
        return new ChatApi(whatsappApiUrl, whatsappApiToken).forwardMessage(payload)
          .then(() => res.status(200).end())
          .catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  startNew (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.string().required(),
      message: Joi.string().required(),
      name: Joi.string().required(),
      phone: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, teammateId: senderId, teammateId, contactId, message, phone, name } = value
    phone = phone.replace(/\D/g, '')
    const isValidphone = [11, 12].includes(phone.length)
    if (!isValidphone) return res.status(422).json({ error: 'invalid_phone' })
    const collectCustomer = () => {
      return this.collectCustomer({ _id: ObjectId(customerId) })
    }
    function sendText (customer) {
      const payload = {
        phone,
        body: message
      }
      return new ChatApi(customer.whatsappApiUrl, customer.whatsappApiToken).send().text(payload)
    }
    const insertConversation = (messageId, contactId) => {
      return this.insertConversation({
        customerId,
        teammateId,
        contactId,
        message,
        messageId,
        senderId,
        type: 'chat',
        createdAt: moment().format(),
        isFromTeammate: true
      })
    }
    const collectContact = () => {
      return this.collectContact({ customerId, whatsapp: phone })
    }
    function insertContact () {
      return new Contacts()
        .insertOne({
          customerId,
          whatsapp: phone,
          charPhotoColor: randomColor({ hue: 'random', luminosity: 'dark', format: 'hex' }),
          createdAt: moment().format(),
          name,
          teammateId
        })
    }
    function sendConversation (customer, contact) {
      sendText(customer)
        .then(response => {
          const messageId = response.data.id
          if (!messageId) return res.status(403).end()
          insertConversation(messageId, contact._id.toString())
            .then(conversation => {
              conversation.messageId = messageId
              contact.conversation = conversation
              res.json(contact)
              setTimeout(() => new Socket(customerId).channel('created:conversation').emit(customerId, conversation), 300)
              setTimeout(() => new Socket(customerId).channel('created:conversation').emit(contactId, conversation), 300)
            }).catch(() => res.status(403).end())
        }).catch(() => res.status(403).end())
    }
    Promise.all([collectCustomer(), collectContact()])
      .then(results => {
        const customer = results[0]
        const contact = results[1]
        if (_.isEmpty(contact)) {
          return insertContact()
            .then(contact => sendConversation(customer, contact))
            .catch(() => res.status(403).end())
        }
        sendConversation(customer, contact)
      }).catch(() => res.status(403).end())
  }

  sendFile (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.string().required(),
      contactId: Joi.string().required(),
      message: Joi.string().required(),
      fileName: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, teammateId: senderId, teammateId, contactId, message, fileName } = value
    const collectCustomer = () => this.collectCustomer({ _id: ObjectId(customerId) })
    const collectContact = () => this.collectContact({ _id: ObjectId(contactId) })
    function send (customer, contact, body) {
      const payload = {
        phone: contact.whatsapp,
        body,
        filename: fileName
      }
      return new ChatApi(customer.whatsappApiUrl, customer.whatsappApiToken).send().file(payload)
    }
    const insertConversation = (messageId, url) => {
      return this.insertConversation({
        customerId,
        teammateId,
        contactId,
        message: url,
        messageId,
        senderId,
        type: 'document',
        createdAt: moment().format(),
        isFromTeammate: true,
        fileName
      })
    }
    Promise.all([collectCustomer(), collectContact()])
      .then(results => {
        const customer = results[0]
        const contact = results[1]
        if (_.isEmpty(customer) || _.isEmpty(contact)) throw new Error()
        const extension = _.last(fileName.split('.'))
        const uniqId = shortId.generate()
        const filepath = `files/${customerId}/${uniqId}.${extension}`
        const mimeType = `application/${extension}`
        new Storage().put(message, filepath, mimeType)
          .then(url => {
            send(customer, contact, url)
              .then(response => {
                const messageId = response.data.id
                insertConversation(messageId, url)
                  .then(conversation => {
                    const { data } = response
                    res.json(data)
                    setTimeout(() => new Socket(customerId).channel('created:conversation').emit(customerId, conversation), 300)
                    setTimeout(() => new Socket(customerId).channel('created:conversation').emit(contactId, conversation), 400)
                  }).catch(() => res.status(403).end())
              }).catch(() => res.status(403).end())
          }).catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  sendLocation (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      contactId: Joi.string().required(),
      lat: Joi.number().required(),
      lng: Joi.number().required(),
      address: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, contactId, lat, lng, address } = value
    function send (customer, phone) {
      const { whatsappApiInstanceId, whatsappApiToken } = customer
      var payload = {
        phone,
        lat,
        lng,
        address
      }
      return new ChatApi(null, whatsappApiToken).send().location(whatsappApiInstanceId, payload)
    }
    this.collectCustomer({ _id: ObjectId(customerId) })
      .then(customer => {
        this.collectContact({ _id: ObjectId(contactId) })
          .then(contact => {
            const { whatsapp: phone } = contact
            send(customer, phone)
              .then(result => res.json(result.data))
              .catch(() => res.status(403).end())
          }).catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  internal () {
    const put = (req, res) => {
      const data = req.body
      const schema = {
        customerId: Joi.string().required(),
        teammateId: Joi.string().required(),
        contactId: Joi.string().required(),
        message: Joi.string().required()
      }
      const { error, value } = Joi.validate(data, schema)
      if (error) return res.status(422).json({ error: formatJoiError(error) })
      var { customerId, teammateId, contactId, message } = value
      const insertInternal = () => {
        return this.insertConversation({
          customerId,
          teammateId,
          messageId: shortId.generate(),
          contactId,
          message,
          type: 'chat',
          createdAt: moment().format(),
          isFromTeammate: true,
          isInternal: true
        })
      }
      insertInternal()
        .then(conversation => res.json(conversation))
        .catch(() => res.status(403).end())
    }
    return { put }
  }

  readAll (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      contactId: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, contactId } = value
    const updateContact = () => new Contacts().updateOne({ _id: ObjectId(contactId) }, { $set: { 'lastConversation.unreads': 0 } })
    const collectCustomer = () => this.collectCustomer({ _id: ObjectId(customerId) })
    const updateConversations = () => {
      const query = { customerId, contactId, isFromTeammate: false, isRead: { $ne: true } }
      const data = { $set: { isRead: true } }
      return new Conversations()
        .updateMany(query, data)
    }
    const readChat = (whatsappApiUrl, whatsappApiToken, payload) => {
      return new ChatApi(whatsappApiUrl, whatsappApiToken).readChat(payload)
    }
    Promise.all([collectCustomer(), updateContact()])
      .then(results => {
        const customer = results[0]
        const contact = results[1]
        const payload = { phone: contact.whatsapp }
        readChat(customer.whatsappApiUrl, customer.whatsappApiToken, payload)
        updateConversations()
          .then(() => res.json(true))
          .catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }
}

module.exports = ConversationsController
