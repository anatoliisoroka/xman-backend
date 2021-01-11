const Joi = require('joi')
const _ = require('lodash')
const { ObjectId } = require('mongodb')
const moment = require('moment')
const Controller = require('./Controller')
const { formatJoiError } = require('../helpers')
const { ContactTags, Tags } = require('../model')

class ContactTagsController extends Controller {
  collectTags (query, options) {
    return new Tags().find(query, options)
  }

  collectContactTags (query, options) {
    return new ContactTags().find(query, options)
  }

  put (req, res) {
    const schema = {
      customerId: Joi.string().required(),
      contactId: Joi.string().required(),
      teammateId: Joi.string().required(),
      name: Joi.string().required()
    }
    const { error, value } = Joi.validate(req.body, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const checkExistTag = () => {
      return new Promise((resolve, reject) => {
        this.collectTags({ customerId: value.customerId })
          .then(tags => {
            const existingTags = tags.map(tag => {
              let isExist = _.toLower(tag.name) === _.toLower(value.name)
              if (isExist) return tag
            })
            const existingTag = _.first(_.compact(existingTags))
            resolve(existingTag)
          }).catch(error => reject(error))
      })
    }
    const insertTag = () => {
      const query = {
        customerId: value.customerId,
        name: value.name,
        createdAt: moment().format()
      }
      return new Tags()
        .insertOne(query)
    }
    function insertContactTag (tag) {
      const query = { customerId: value.customerId, contactId: value.contactId, tagId: tag._id.toString() }
      new ContactTags()
        .findOne(query)
        .then(existingContactTag => {
          if (!existingContactTag) {
            return insert()
              .then(contactTag => {
                contactTag.tag = tag
                res.json(contactTag)
              }).catch(() => res.status(403).end())
          }
          throw new Error()
        }).catch(() => res.status(422).json({ error: 'tag_already_added' }))
      const insert = () => {
        const query = {
          customerId: value.customerId,
          teammateId: value.teammateId,
          contactId: value.contactId,
          tagId: tag._id.toString(),
          createdAt: moment().format()
        }
        return new ContactTags()
          .insertOne(query)
      }
    }
    checkExistTag()
      .then(existingTag => {
        if (existingTag) return insertContactTag(existingTag)
        insertTag()
          .then(tag => insertContactTag(tag))
          .catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  getAll (req, res) {
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      contactId: Joi.string().required()
    }
    const { error, value } = Joi.validate(req.query, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, contactId } = value
    Promise.all([
      this.collectTags({ customerId }),
      this.collectContactTags({ customerId, contactId })
    ])
      .then(results => {
        const tags = results[0]
        var contactTags = results[1]
        contactTags = contactTags.map(contactTag => {
          contactTag.tag = _.find(tags, { _id: ObjectId(contactTag.tagId) })
          return contactTag
        })
        res.json(contactTags)
      }).catch(() => res.status(403).end())
  }

  delete (req, res) {
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      contactId: Joi.string().required(),
      tagId: Joi.string().required()
    }
    const { error, value } = Joi.validate(req.body, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, contactId, tagId } = value
    const query = { customerId, contactId, _id: ObjectId(tagId) }
    new ContactTags()
      .deleteOne(query)
      .then(() => res.status(200).end())
      .catch(() => res.status(403).end())
  }

  bulkInsert (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      contacts: Joi.array().items(Joi.object().required()).required(),
      tags: Joi.array().items(Joi.string().trim().required()).required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, contacts, tags } = value
    const insertAndCollectTags = () => {
      function inserts () {
        const bulkInserts = tags.map(tagName => {
          const query = { customerId, name: tagName }
          const data = { $set: { customerId, name: tagName, createdAt: moment().format() } }
          const options = { upsert: true }
          return new Tags()
            .updateOne(query, data, options)
        })
        return _.flatten(bulkInserts)
      }
      const collects = () => {
        const bulkCollect = tags.map(tagName => this.collectTags({ customerId, name: tagName }))
        return _.flatten(bulkCollect)
      }
      return new Promise((resolve, reject) => {
        Promise.all(inserts())
          .then(() => {
            Promise.all(collects())
              .then(tags => {
                tags = _.flatten(tags)
                resolve(tags)
              }).catch(error => reject(error))
          }).catch(error => reject(error))
      })
    }
    const insertAndCollectContactTags = (contacts, tags) => {
      function inserts () {
        const bulkInserts = contacts.map(contact => {
          return tags.map(tag => {
            const contactTag = {
              customerId,
              teammateId: contact.teammateId,
              contactId: contact._id.toString(),
              tagId: tag._id.toString(),
              createdAt: moment().format()
            }
            const query = {
              customerId,
              contactId: contactTag.contactId,
              tagId: contactTag.tagId
            }
            const data = { $set: contactTag }
            return new ContactTags()
              .updateOne(query, data, { upsert: true })
          })
        })
        return _.flatten(bulkInserts)
      }
      const collects = () => {
        const bulkCollect = contacts.map(contact => {
          return this.collectContactTags({ customerId, contactId: contact._id.toString() })
        })
        return _.flatten(bulkCollect)
      }
      return new Promise((resolve, reject) => {
        Promise.all(inserts())
          .then(() => {
            Promise.all(collects())
              .then(contactTags => {
                contactTags = _.flatten(contactTags)
                resolve(contactTags)
              }).catch(error => reject(error))
          }).catch(error => reject(error))
      })
    }
    insertAndCollectTags()
      .then(tags => {
        Promise.all([insertAndCollectContactTags(contacts, tags), this.collectTags({ customerId })])
          .then(results => {
            const contactTags = results[0]
            const allTags = results[1]
            const result = contacts.map(contact => {
              contact.contactTags = _.filter(contactTags, { contactId: contact._id.toString() })
              contact.contactTags = contact.contactTags.map(contactTag => {
                contactTag.tag = _.find(allTags, { _id: ObjectId(contactTag.tagId) })
                return contactTag
              })
              return contact
            })
            res.json(result)
          }).catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }
}

module.exports = ContactTagsController
