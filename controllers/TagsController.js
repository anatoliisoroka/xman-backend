const Joi = require('joi')
const _ = require('lodash')
const ObjectId = require('mongodb').ObjectId
const Controller = require('./Controller')
const { formatJoiError } = require('../helpers')
const { Broadcasts, ContactTags, Keywords, Tags } = require('../model')

class TagsController extends Controller {
  collectTags (query) {
    return new Tags().find(query)
  }
  updateKeywords (query, data) {
    return new Keywords().updateMany(query, data)
  }

  getAll (req, res) {
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow()
    }
    const { error, value } = Joi.validate(req.body, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId } = value
    this.collectTags({ customerId })
      .then(tags => {
        tags = _.orderBy(tags, 'createdAt', 'desc')
        res.json(tags)
      }).catch(() => res.status(403).end())
  }

  withContactCounts (req, res) {
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow()
    }
    const { error, value } = Joi.validate(req.body, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId } = value
    function collectContactTags (tag) {
      return new Promise((resolve, reject) => {
        const { _id, name } = tag
        const tagId = _id.toString()
        new ContactTags().find({ customerId, tagId })
          .then(contactTags => {
            var count = contactTags.length
            resolve({ _id: tagId, name, count })
          }).catch(error => reject(error))
      })
    }
    this.collectTags({ customerId })
      .then(tags => {
        tags = _.orderBy(tags, 'createdAt', 'desc')
        const contactTags = () => tags.map(tag => collectContactTags(tag))
        Promise.all(contactTags())
          .then(result => res.json(result))
          .catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  delete (req, res) {
    const { customerId } = req.body
    const { tagId } = req.params
    if (_.isEmpty(tagId)) return res.status(422).end()
    const collectBroadcasts = () => new Broadcasts().find({ customerId, 'conditions.tagId': tagId })
    function updateBroadcastsConditions () {
      return new Promise((resolve, reject) => {
        function fix (broadcast) {
          const { _id } = broadcast
          const conditions = _.reject(broadcast.conditions, ['tagId', tagId])
          return new Broadcasts().updateOne({ _id }, { $set: { conditions } })
        }
        collectBroadcasts()
          .then(broadcasts => {
            const bulkFix = () => broadcasts.map(broadcast => fix(broadcast))
            Promise.all(bulkFix())
              .then(() => resolve())
              .catch(error => reject(error))
          }).catch(error => reject(error))
      })
    }
    const keywords = () => {
      function collectEmptiableTags () {
        return new Promise((resolve, reject) => {
          const query = { customerId, 'meta.tags': { $in: [tagId] } }
          new Keywords().find(query)
            .then(keywords => {
              const hasSingleTag = keyword => keyword.meta.tags.length === 1
              const emptiableKeywords = _.filter(keywords, keyword => hasSingleTag(keyword))
              resolve(emptiableKeywords)
            }).catch(error => reject(error))
        })
      }
      const pullTags = () => {
        return this.updateKeywords({ customerId, 'meta.tags': { $in: [tagId] } }, { $pull: { 'meta.tags': tagId } })
      }
      const pullActions = (keywords) => {
        const pullAction = (keyword) => {
          const { _id } = keyword
          return this.updateKeywords({ _id }, { $pull: { actions: 'addTag' } })
        }
        const bulkPull = () => keywords.map(keyword => pullAction(keyword))
        return Promise.all(bulkPull())
      }
      return new Promise((resolve, reject) => {
        collectEmptiableTags()
          .then(emptiableKeywords => {
            pullTags()
              .then(() => {
                pullActions(emptiableKeywords)
                  .then(() => resolve())
                  .catch(error => reject(error))
              }).catch(error => reject(error))
          }).catch(error => reject(error))
      })
    }
    const deleteContactTags = () => new ContactTags().deleteMany({ customerId, tagId })
    const broadcasts = () => new Broadcasts().updateMany({ customerId }, { $pull: { conditions: { tagId } } })
    const deleteTag = () => new Tags().deleteOne({ customerId, _id: ObjectId(tagId) })
    Promise.all([updateBroadcastsConditions(), deleteContactTags(), keywords(), broadcasts(), deleteTag()])
      .then(() => res.end())
      .catch(() => res.status(403).end())
  }
}

module.exports = TagsController
