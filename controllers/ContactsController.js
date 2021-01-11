const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const Fuse = require('fuse.js')
const ObjectId = require('mongodb').ObjectId
const Joi = require('joi')
const randomColor = require('randomcolor')
const moment = require('moment-timezone')
const papaParse = require('papaparse')
const https = require('https')
const dauria = require('dauria')
const anyToUtf8 = require('any-to-utf8')
const dataUriToBuffer = require('data-uri-to-buffer')
const { google } = require('googleapis')
const nanoid = require('nanoid')
const Controller = require('./Controller')
const { formatJoiError, paginate } = require('../helpers')
const { Socket, Queue, Storage, ChatApi } = require('../services')
const {
  Customers,
  AssignmentRules,
  Broadcasts,
  Contacts,
  ContactRemarks,
  Conversations,
  ContactTags,
  CustomFields,
  GroupConversations,
  GroupParticipants,
  Groups,
  Keywords,
  Mentions,
  ScheduledMessages,
  SnoozeContactJobs,
  BroadcastJobs,
  Tags,
  Subscriptions
} = require('../model')
require('dotenv').config()

class ContactsController extends Controller {
  collectCustomer (query) {
    return new Customers()
      .findOne(query)
  }

  collectContact (query, options) {
    return new Contacts()
      .findOne(query, options)
  }

  collectContacts (query, options) {
    return new Contacts()
      .find(query, options)
  }

  collectContactsPaginate (query, skip, limit) {
    return new Contacts()
      .paginate(query, skip, limit)
  }

  insertContact (data) {
    return new Contacts()
      .insertOne(data)
  }

  collectContactTags (query, options) {
    return new ContactTags()
      .find(query, options)
  }

  updateContact (query, data, options) {
    return new Contacts()
      .updateOne(query, data, options)
  }

  contactsWithLastConversation (customerId) {
    return new Promise((resolve, reject) => {
      const query = { customerId, isBlocked: { $ne: true } }
      this.collectContacts(query)
        .then(contacts => {
          const contactsWithConversation = contacts.map(contact => {
            if (!contact.lastConversation) contact.lastConversation = {}
            if (!contact.lastConversation.createdAt) contact.lastConversation.createdAt = 0
            return contact
          })
          resolve(contactsWithConversation)
        }).catch(error => reject(error))
    })
  }

  groupsWithLastConversation (customerId) {
    const query = { customerId }
    function collectGroups () {
      return new Groups()
        .find(query)
    }
    return new Promise((resolve, reject) => {
      collectGroups()
        .then(groups => {
          groups = groups.map(group => {
            if (!group.lastConversation) group.lastConversation = {}
            if (!group.lastConversation.createdAt) group.lastConversation.createdAt = 0
            group.isGroup = true
            return group
          })
          resolve(groups)
        }).catch(error => reject(error))
    })
  }

  transformLastConversation (contacts, groups) {
    contacts = _.reject(contacts, { isArchived: true })
    var result = _.concat(contacts, groups)
    var withoutConversation = _.filter(result, contact => contact.lastConversation.createdAt === 0)
    var withConversation = _.filter(result, contact => contact.lastConversation.createdAt !== 0)
    withoutConversation = _.orderBy(withoutConversation, contact => contact.createdAt, ['desc'])
    result = withConversation.concat(withoutConversation)
    result = _.orderBy(result, contact => contact.lastConversation.createdAt, ['desc'])
    return result
  }

  withLastConversation (req, res) {
    const { from } = req.query
    const { customerId } = req.body
    Promise.all([this.contactsWithLastConversation(customerId), this.groupsWithLastConversation(customerId)])
      .then(results => {
        const [ contacts, groups ] = results
        var result = this.transformLastConversation(contacts, groups)
        result = paginate(result, from)
        res.json(result)
      }).catch(() => res.status(403).end())
  }

  assignedWithLastConversation (req, res) {
    const { from } = req.query
    const { customerId, teammateId } = req.body
    this.contactsWithLastConversation(customerId)
      .then(result => {
        result = _.reject(result, { isArchived: true })
        result = _.filter(result, { teammateId })
        result = _.orderBy(result, contact => contact.lastConversation.createdAt, ['desc'])
        result = paginate(result, from)
        res.json(result)
      }).catch(() => res.status(403).end())
  }

  archivedWithLastConversation (req, res) {
    const { from } = req.query
    const { customerId } = req.body
    this.contactsWithLastConversation(customerId)
      .then(result => {
        result = _.filter(result, { isArchived: true })
        result = _.orderBy(result, contact => contact.lastConversation.createdAt, ['desc'])
        result = paginate(result, from)
        res.json(result)
      }).catch(() => res.status(403).end())
  }

  unreadWithLastConversation (req, res) {
    const { from } = req.query
    const { customerId } = req.body
    this.contactsWithLastConversation(customerId)
      .then(result => {
        result = _.filter(result, { lastConversation: { isFromTeammate: false } })
        result = _.reject(result, contact => !contact.lastConversation.unreads)
        result = _.orderBy(result, contact => contact.lastConversation.createdAt, ['desc'])
        result = paginate(result, from)
        res.json(result)
      }).catch(() => res.status(403).end())
  }

  mentionedWithLastConversation (req, res) {
    const { customerId, teammateId } = req.body
    const collectMentions = () => new Mentions().find({ customerId, toId: teammateId })
    Promise.all([this.contactsWithLastConversation(customerId), collectMentions()])
      .then(results => {
        const { from } = req.query
        var [ contacts, mentions ] = results
        var mentionedContactIds = mentions.map(mention => mention.contactId)
        mentionedContactIds = _.uniq(mentionedContactIds)
        contacts = mentionedContactIds.map(contactId => _.find(contacts, { _id: ObjectId(contactId) }))
        contacts = _.orderBy(contacts, contact => contact.lastConversation.createdAt, ['desc'])
        contacts = paginate(contacts, from)
        res.json(contacts)
      }).catch(() => res.status(403).end())
  }

  searchWithLastConversation (req, res) {
    const { from, keyword } = req.query
    const { customerId } = req.body
    this.contactsWithLastConversation(customerId)
      .then(result => {
        if (keyword) {
          const fuse = new Fuse(result, { keys: ['email', 'name', 'whatsapp', 'conversation.message'] })
          result = fuse.search(keyword)
        }
        result = paginate(result, from)
        res.json(result)
      }).catch(() => res.status(403).end())
  }

  getOne (req, res) {
    const { query: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      contactId: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, contactId } = value
    const query = { customerId, _id: ObjectId(contactId) }
    this.collectContact(query)
      .then(contact => res.json(contact))
      .catch(() => res.status(403).end())
  }

  getAll (req, res) {
    var { from } = req.query
    const { customerId } = req.body
    const data = { customerId }
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow()
    }
    const { error } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const collectTags = () => new Tags().find({ customerId })
    from = Number(from)
    Promise.all([
      this.collectContactsPaginate({ customerId }, from, 20),
      this.collectContactTags({ customerId }),
      collectTags()
    ])
      .then(results => {
        var contacts = results[0]
        const allcontactTags = results[1]
        const tags = results[2]
        contacts = contacts.map(contact => {
          var contactTags = _.filter(allcontactTags, { contactId: contact._id.toString() })
          contactTags = contactTags.map(contactTag => {
            contactTag.tag = _.find(tags, { _id: ObjectId(contactTag.tagId) })
            return contactTag
          })
          contact.contactTags = contactTags
          return contact
        })
        contacts = _.orderBy(contacts, 'createdAt', ['desc'])

        from = from || 0
        const to = from + 20
        contacts = { data: contacts, from, to }
        res.json(contacts)
      }).catch(() => res.status(403).end())
  }

  search (req, res) {
    var { from, keyword } = req.query
    const { customerId } = req.body
    const data = { customerId }
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow()
    }
    const { error } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const collectTags = () => new Tags().find({ customerId })
    from = Number(from)
    const collectContactIdsSearchWithTags = () => {
      return new Promise((resolve, reject) => {
        const query = { customerId,
          $or: [
            { name: RegExp(keyword, 'i') }
          ] }
        const collectSearchTags = () => new Tags().find(query)
        collectSearchTags()
          .then(tags => {
            const tagIds = _.map(tags, tag => tag._id.toString())
            this.collectContactTags({ tagId: { $in: tagIds } })
              .then(contactTags => {
                var contactIds = contactTags.map(contactTag => contactTag.contactId)
                contactIds = _.uniq(contactIds)
                resolve(contactIds)
              }).catch(error => reject(error))
          }).catch(error => reject(error))
      })
    }
    const collectContactIds = () => {
      const query = {
        customerId,
        $or: [
          { name: RegExp(keyword, 'i') },
          { whatsapp: RegExp(keyword, 'i') }
        ]
      }
      const options = { projection: { _id: 1 } }
      return this.collectContacts(query, options)
    }
    Promise.all([
      collectContactIds(),
      this.collectContactTags({ customerId }),
      collectTags(),
      collectContactIdsSearchWithTags()
    ])
      .then(results => {
        var contactIds = results[0]
        const allcontactTags = results[1]
        const tags = results[2]
        const contactIdsSearchWithTags = results[3]
        contactIds = contactIds.map(contactId => contactId._id.toString())
        contactIds = _.union(contactIdsSearchWithTags, contactIds)
        contactIds = _.map(contactIds, contactId => ObjectId(contactId))
        this.collectContacts({ _id: { $in: contactIds } })
          .then(contacts => {
            contacts = contacts.map(contact => {
              var contactTags = _.filter(allcontactTags, { contactId: contact._id.toString() })
              contactTags = contactTags.map(contactTag => {
                contactTag.tag = _.find(tags, { _id: ObjectId(contactTag.tagId) })
                return contactTag
              })
              contact.contactTags = contactTags
              return contact
            })
            contacts = _.orderBy(contacts, 'createdAt', ['desc'])
            const fuse = new Fuse(contacts, { keys: ['name', 'whatsapp', 'contactTags.tag.name'] })
            contacts = fuse.search(keyword)
            contacts = paginate(contacts, from)
            res.json(contacts)
          }).catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  patch (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      contactId: Joi.string().required(),
      name: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, contactId, name } = value
    const update = (contact) => {
      const isRenamed = contact.name !== name
      if (!isRenamed) return Promise.resolve({ value: contact })
      const query = { _id: ObjectId(contactId), customerId }
      const data = { $set: { name, isRenamed: true } }
      const options = { returnOriginal: false }
      return this.updateContact(query, data, options)
    }
    this.collectContact({ _id: ObjectId(contactId) }, null)
      .then(contact => {
        update(contact)
          .then(contact => res.json(contact))
          .catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  post (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      dataUri: Joi.string().dataUri().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, teammateId, dataUri } = value
    const buffer = dataUriToBuffer(dataUri)
    function parseCsv (url) {
      return new Promise((resolve, reject) => {
        var req = https.request(url)
        function complete (results, file) {
          const csv = results.data
          resolve(csv)
        }
        const error = error => reject(error)
        req.on('response', readableStream => {
          const options = { header: true, complete, error, skipEmptyLines: true }
          papaParse.parse(readableStream, options)
        })
        req.end()
      })
    }
    anyToUtf8(buffer)
      .then(csvBuffer => {
        const dataUri = dauria.getBase64DataURI(csvBuffer, 'application/csv')
        const filepath = `csvs/${nanoid()}.csv`
        const mimeType = 'application/csv'
        new Storage().put(dataUri, filepath, mimeType)
          .then(url => {
            parseCsv(url)
              .then(contacts => {
                new Queue().ContactsImport(customerId, teammateId, contacts)
                res.end()
              }).catch(() => res.status(422).json({ error: 'failed_to_parse_the_template_please_try_again' }))
          }).catch(() => res.status(422).json({ error: 'failed_to_upload_please_try_again' }))
      }).catch(() => res.status(422).json({ error: 'invalid_text_encoding_make_sure_exporting_csv_as_utf8' }))
  }

  assignTeammate (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      contactId: Joi.string().required(),
      teammateId: Joi.allow(),
      id: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, contactId, id: teammateId } = value
    const updateContact = (teammateId) => {
      const query = { customerId, _id: ObjectId(contactId) }
      const data = { $set: { teammateId } }
      return this.updateContact(query, data)
    }
    function updateContactTags (teammateId) {
      const query = { customerId, contactId }
      const data = { $set: { teammateId } }
      return new ContactTags()
        .updateMany(query, data)
    }
    function updateConversations (teammateId) {
      const query = { customerId, contactId }
      const data = { $set: { teammateId } }
      return new Conversations()
        .updateMany(query, data)
    }
    function socketEmit (teammateId) {
      return new Socket(customerId).channel('assigned').emit(teammateId, {})
    }
    function assignmentRuleContactAssignToCheck (teammateId) {
      const query = {
        customerId,
        isActive: true,
        category: 'contact',
        condition: 'assignTo',
        value: teammateId
      }
      new AssignmentRules()
        .findOne(query)
        .then(rule => {
          if (_.isEmpty(rule)) return socketEmit(teammateId)
          const { assigneeId } = rule
          Promise.all([updateContact(assigneeId), updateContactTags(assigneeId), updateConversations(assigneeId)])
            .then(() => socketEmit(assigneeId))
            .catch(() => {})
        }).catch(() => {})
    }
    Promise.all([updateContact(teammateId), updateContactTags(teammateId), updateConversations(teammateId)])
      .then(() => {
        assignmentRuleContactAssignToCheck(teammateId)
        res.json(true)
      }).catch(() => res.status(403).end())
  }

  blockContact (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      contactId: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, contactId } = value
    const query = { customerId, _id: ObjectId(contactId) }
    const update = { $set: { isBlocked: true } }
    this.updateContact(query, update)
      .then(contact => res.json(contact))
      .catch(() => res.status(403).end())
  }

  unblockContact (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      contactId: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, contactId } = value
    const query = { customerId, _id: ObjectId(contactId) }
    const update = { $set: { isBlocked: false } }
    this.updateContact(query, update)
      .then(contact => res.json(contact))
      .catch(() => res.status(403).end())
  }

  archive (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      contactId: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, contactId } = value
    const query = { customerId, _id: ObjectId(contactId) }
    const update = { $set: { isArchived: true } }
    this.updateContact(query, update)
      .then(contact => {
        res.json(contact)
        new Socket(customerId)
          .channel('archived')
          .emit(customerId, contact)
      }).catch(() => res.status(403).end())
  }

  unarchive (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      contactId: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, contactId } = value
    const query = { customerId, _id: ObjectId(contactId) }
    const update = { $set: { isArchived: false } }
    this.updateContact(query, update)
      .then(contact => res.json(contact))
      .catch(() => res.status(403).end())
  }

  snooze (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      contactId: Joi.string().required(),
      unarchiveOn: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, contactId } = value
    var { unarchiveOn } = value
    const collectCustomerTimezone = () => {
      return new Promise((resolve, reject) => {
        const query = { _id: ObjectId(customerId) }
        return this.collectCustomer(query)
          .then(customer => {
            const { timezone } = customer
            resolve(timezone)
          }).catch(error => reject(error))
      })
    }
    function unarchiveDatetime (timezone) {
      var datetime
      switch (unarchiveOn) {
        case 'tomorrow':
          datetime = moment().tz(timezone)
            .add(1, 'day')
            .set({ 'hour': 9, 'minute': 0 })
            .tz(moment.tz.guess())
            .format('LLL')
          break
        case 'monday':
          datetime = moment().tz(timezone)
            .day(8)
            .tz(moment.tz.guess())
            .format('LLL')
          break
        case 'week':
          datetime = moment().tz(timezone)
            .add(1, 'week')
            .tz(moment.tz.guess())
            .format('LLL')
          break
        case 'month':
          datetime = moment().tz(timezone)
            .add(1, 'month')
            .tz(moment.tz.guess())
            .format('LLL')
          break
        default:
          datetime = moment().tz(timezone)
            .add(3, 'hours')
            .tz(moment.tz.guess())
            .format('LLL')
          break
      }
      return datetime
    }
    function insertSnoozeJob (unarchiveOn) {
      const data = {
        customerId,
        contactId,
        unarchiveOn,
        createdAt: moment().format()
      }
      return new SnoozeContactJobs()
        .insertOne(data)
    }
    collectCustomerTimezone()
      .then(timezone => {
        if (_.isEmpty(timezone)) return res.status(422).json({ error: 'must_be_set_timezone_from_account_settings_in_order_to_snooze' })
        const unarchiveOn = unarchiveDatetime(timezone)
        insertSnoozeJob(unarchiveOn)
          .then(() => res.status(200).end())
          .catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  getids (req, res) {
    const { customerId } = req.body
    const collectContactIds = () => {
      const query = { customerId }
      const options = { projection: { _id: true, teammateId: true } }
      return this.collectContacts(query, options)
    }
    collectContactIds()
      .then(contacts => res.json(contacts))
      .catch(() => res.status(403).end())
  }

  markAsUnread (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      contactId: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, contactId } = value
    const query = { customerId, _id: ObjectId(contactId) }
    const update = { $set: { hasUnread: true } }
    const options = { returnOriginal: false }
    this.updateContact(query, update, options)
      .then(contact => res.json(contact))
      .catch(() => res.status(403).end())
  }

  markAsRead (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      contactId: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, contactId } = value
    const query = { customerId, _id: ObjectId(contactId) }
    const update = { $set: { hasUnread: false } }
    const options = { returnOriginal: false }
    this.updateContact(query, update, options)
      .then(contact => res.json(contact))
      .catch(() => res.status(403).end())
  }

  create (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.string().required(),
      name: Joi.string().required(),
      phone: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, teammateId, name, phone } = value
    phone = phone.replace(/\D/g, '')
    const isValidphone = [11, 12].includes(phone.length)
    if (!isValidphone) return res.status(422).json({ error: 'invalid_phone' })
    const updateContactName = (contactId) => {
      const query = { _id: contactId }
      const update = { $set: { name } }
      const options = { returnOriginal: false }
      return this.updateContact(query, update, options)
    }
    const insert = () => {
      const data = {
        customerId,
        name,
        whatsapp: phone,
        teammateId,
        charPhotoColor: randomColor({ hue: 'random', luminosity: 'dark', format: 'hex' }),
        createdAt: moment().format()
      }
      return this.insertContact(data)
    }
    const query = { customerId, whatsapp: phone }
    this.collectContact(query)
      .then(contact => {
        if (_.isEmpty(contact)) {
          return insert()
            .then(contact => {
              contact.contactTags = []
              res.json({ contact, isNew: true })
            }).catch(() => res.status(403).end())
        }
        updateContactName(contact._id)
          .then(contact => res.json({ contact }))
          .catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  updateName (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      contactId: Joi.string().required(),
      name: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { contactId, name } = value
    const updateContactName = () => {
      const query = { _id: ObjectId(contactId) }
      const update = { $set: { name, isRenamed: true } }
      return this.updateContact(query, update)
    }
    updateContactName()
      .then(() => res.status(200).end())
      .catch(() => res.status(403).end())
  }

  share (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      phone: Joi.string().required(),
      vcard: Joi.object().keys({
        name: Joi.string().required(),
        phone: Joi.number().required()
      })
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, phone, vcard: { name: firstName, phone: whatsapp } } = value
    const query = { _id: ObjectId(customerId) }
    this.collectCustomer(query)
      .then(customer => {
        const { whatsappApiInstanceId, whatsappApiToken } = customer
        const payload = {
          phone,
          vcard: {
            firstName,
            lastName: ' ',
            phone: whatsapp
          }
        }
        return new ChatApi(null, whatsappApiToken)
          .send()
          .vcard(payload, whatsappApiInstanceId)
          .then(result => res.json(result.data))
          .catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  googleContactsSync (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, teammateId } = value
    function oAuth2Client () {
      return new Promise((resolve, reject) => {
        fs.readFile(path.join(__dirname, '../credentials.json'), (error, content) => {
          if (error) return reject(error)
          const credentials = JSON.parse(content)
          const { client_secret: clientSecret, client_id: clientId, redirect_uris: redirectUris } = credentials.web
          const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUris[0])
          resolve(oAuth2Client)
        })
      })
    }
    function refreshAccessToken (client) {
      client.on('tokens', tokens => {
        const { access_token: gmailAccessToken } = tokens
        const query = { _id: ObjectId(customerId) }
        const data = { $set: { gmailAccessToken } }
        new Customers().updateOne(query, data)
      })
    }
    function auth (customer) {
      return new Promise((resolve, reject) => {
        oAuth2Client()
          .then(oAuth2Client => {
            const { gmailRefreshToken, gmailAccessToken } = customer
            oAuth2Client.setCredentials({ access_token: gmailAccessToken })
            resolve(oAuth2Client)
            refreshAccessToken(oAuth2Client)
            oAuth2Client.setCredentials({ refresh_token: gmailRefreshToken })
          }).catch(error => reject(error))
      })
    }
    const insertContact = (contact) => {
      return new Promise((resolve, reject) => {
        const { name, whatsapp } = contact
        const existance = () => {
          return new Promise((resolve, reject) => {
            const query = { whatsapp, customerId }
            this.collectContact(query)
              .then(contact => resolve(contact))
              .catch(error => reject(error))
          })
        }
        const insert = () => {
          const data = {
            customerId,
            teammateId,
            whatsapp,
            charPhotoColor: randomColor({ hue: 'random', luminosity: 'dark', format: 'hex' }),
            name,
            isRenamed: true,
            createdAt: moment().format()
          }
          return this.insertContact(data)
        }
        const updateContactName = (contact) => {
          const { whatsapp, isRenamed } = contact
          if (isRenamed) return Promise.resolve(contact)
          const query = { whatsapp, customerId }
          const data = { $set: { name, isRenamed: true } }
          const options = { returnOriginal: false }
          return this.updateContact(query, data, options)
        }
        return existance()
          .then(contact => {
            const isExists = !_.isEmpty(contact)
            if (!isExists) {
              return insert()
                .then(contact => resolve({ contact, isNew: true }))
                .catch(() => resolve())
            }
            updateContactName(contact)
              .then(contact => resolve({ contact }))
              .catch(() => resolve())
          }).catch(() => resolve())
      })
    }
    this.collectCustomer({ _id: ObjectId(customerId) })
      .then(customer => {
        auth(customer)
          .then(auth => {
            const contacts = google.people({ version: 'v1', auth })
            contacts.people.connections.list({ resourceName: 'people/me', personFields: ['names', 'phoneNumbers'] }, (error, response) => {
              if (error) return res.status(422).json({ error: 'please_integrate_your_google_account_from_settings' })
              if (_.isEmpty(response)) return res.status(422).json({ error: 'no_results_found' })
              let contacts = response['data'].connections
              contacts = contacts.map(contact => {
                const { names, phoneNumbers } = contact
                const name = names[0].displayName
                const whatsapp = phoneNumbers[0].canonicalForm.replace(/\D/g, '')
                if (_.isEmpty(name) || _.isEmpty(whatsapp)) return
                const contactData = { name, whatsapp }
                return contactData
              })
              contacts = _.compact(contacts)
              contacts = _.uniqBy(contacts, 'whatsapp')
              const bulkInsert = contacts.map(contact => insertContact(contact))
              Promise.all(bulkInsert)
                .then(contacts => {
                  contacts = _.compact(contacts)
                  res.json(contacts)
                }).catch(() => res.status(403).end())
            })
          }).catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  deleteAll (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      contactIds: Joi.array().items(Joi.string().trim().required()).required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, contactIds } = value
    function deleteContact (contactId) {
      const query = { customerId, _id: ObjectId(contactId) }
      return new Contacts()
        .deleteOne(query)
    }
    const deleteRelated = (contactId) => {
      const collectContactWhatsapp = () => {
        const query = { _id: ObjectId(contactId) }
        const options = { projection: { whatsapp: 1 } }
        return this.collectContact(query, options)
      }
      const contactRemarks = () => new ContactRemarks().deleteMany({ contactId })
      const conversations = () => new Conversations().deleteMany({ contactId })
      const groupConversations = () => new GroupConversations().deleteMany({ contactId })
      const groupParticipants = () => new GroupParticipants().deleteMany({ contactId })
      const scheduledMessages = () => new ScheduledMessages().deleteMany({ contactId })
      const subscriptions = () => new Subscriptions().deleteMany({ contactId })
      const contactTags = () => new ContactTags().deleteMany({ contactId })
      const snoozeContactJobs = () => new SnoozeContactJobs().deleteMany({ contactId })
      const mentions = () => new Mentions().deleteMany({ contactId })
      function broadcastJobs (whatsapp) {
        return new BroadcastJobs()
          .deleteMany({ customerId, 'message.type': 'vcard', 'message.data': whatsapp })
      }
      function broadcasts (whatsapp) {
        return new Broadcasts()
          .updateMany({ customerId }, { $pull: { messages: { type: 'vcard', data: whatsapp } } })
      }
      function keywords (whatsapp) {
        return new Keywords()
          .updateMany({ customerId },
            { $pull: { 'meta.messages': { type: 'vcard', data: whatsapp } } })
      }
      const customFields = () => new CustomFields().deleteMany({ contactId })
      return new Promise((resolve, reject) => {
        collectContactWhatsapp()
          .then(contact => {
            const { whatsapp } = contact
            Promise.all([
              contactRemarks(),
              conversations(),
              groupConversations(),
              groupParticipants(),
              scheduledMessages(),
              subscriptions(),
              contactTags(),
              snoozeContactJobs(),
              mentions(),
              broadcastJobs(whatsapp),
              broadcasts(whatsapp),
              keywords(whatsapp),
              customFields()
            ]).then(() => resolve())
              .catch(error => reject(error))
          }).catch(error => reject(error))
      })
    }
    function deleteContactData (contactId) {
      return new Promise((resolve, reject) => {
        deleteRelated(contactId)
          .then(() => {
            deleteContact(contactId)
              .then(() => resolve())
              .catch(error => reject(error))
          }).catch(error => reject(error))
      })
    }
    const bulkDelete = () => contactIds.map(contactId => deleteContactData(contactId))
    Promise.all(bulkDelete())
      .then(() => {
        res.end()
        new Socket(customerId).channel('deleted:contact').emit(customerId, contactIds)
      }).catch(() => res.status(403).end())
  }

  export (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId } = value
    const collectContacts = () => {
      return this.collectContacts({ customerId }, { projection: { _id: 1, name: 1, whatsapp: 1 } })
    }
    const collectContactTags = (contact) => {
      function collectTag (contactTag) {
        return new Promise((resolve, reject) => {
          const query = { _id: ObjectId(contactTag.tagId) }
          const options = { projection: { _id: 0, name: 1 } }
          new Tags()
            .findOne(query, options)
            .then(tag => resolve(tag))
            .catch(error => reject(error))
        })
      }
      return new Promise((resolve, reject) => {
        this.collectContactTags({ contactId: contact._id.toString() }, { projection: { _id: 0, tagId: 1 } })
          .then(contactTags => {
            const bulkContactTags = () => contactTags.map(contactTag => collectTag(contactTag))
            Promise.all(bulkContactTags())
              .then(tags => {
                contact.tags = _.map(tags, tag => tag.name)
                resolve(contact)
              }).catch(error => reject(error))
          }).catch(error => reject(error))
      })
    }
    function collectContactsTags (contacts) {
      const bulk = () => contacts.map(contact => collectContactTags(contact))
      return new Promise((resolve, reject) => {
        Promise.all(bulk())
          .then(contacts => resolve(contacts))
          .catch(error => reject(error))
      })
    }
    collectContacts()
      .then(contacts => {
        collectContactsTags(contacts)
          .then(contacts => {
            contacts = _.map(contacts, contact => {
              const { name, whatsapp, tags } = contact
              contact = _.omit(_.set(_.set(contact, 'Name', name), 'Phone', whatsapp), 'name', 'whatsapp', '_id', 'tags')
              _.each(tags, (value, key) => { contact[`Tag ${key + 1}`] = value })
              return contact
            })
            const tagHeaders = _.compact(_.keys(_.mapKeys(
              _.maxBy(contacts, _.size),
              (value, key) => _.includes(key, 'Tag') ? key : ''
            )))
            const fields = ['Name', 'Phone', ...tagHeaders]
            const data = _.map(contacts, contact => _.values(contact))
            const csv = papaParse.unparse({ fields, data })
            const csvBuffer = Buffer.from(csv, 'utf8')
            const mimeType = 'application/csv'
            const dataUri = dauria.getBase64DataURI(csvBuffer, 'application/csv')
            const filepath = `csvs/${customerId}/contacts_${_.size(contacts)}_${moment().unix()}.csv`
            new Storage().put(dataUri, filepath, mimeType)
              .then(url => res.json({ url }))
              .catch(() => res.status(422).json({ error: 'failed_to_generate_export_file_Please_try_again' }))
          }).catch(() => res.status(422).json({ error: 'failed_to_collect_contact_tags_please_try_again' }))
      }).catch(() => res.status(422).json({ error: 'failed_to_collect_contacts_please_try_again' }))
  }

  count (req, res) {
    const { customerId } = req.body
    new Contacts().count({ customerId })
      .then(count => res.json(count))
      .catch(() => res.status(403).end())
  }
}

module.exports = ContactsController
