const Joi = require('joi')
const Fuse = require('fuse.js')
const ObjectId = require('mongodb').ObjectId
const moment = require('moment')
const Controller = require('./Controller')
const { formatJoiError } = require('../helpers')
const { Faqs } = require('../model')

class FaqsController extends Controller {
  collectFaqs (query) {
    return new Faqs().find(query)
  }

  getAll (req, res) {
    const customerId = req.body.customerId
    this.collectFaqs({ customerId })
      .then(faqs => res.json(faqs))
      .catch(() => res.status(403).end())
  }

  delete (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      faqId: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const query = { customerId: value.customerId, _id: ObjectId(value.faqId) }
    new Faqs().deleteOne(query)
      .then(() => res.status(200).end())
      .catch(() => res.status(403).end())
  }

  post (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      question: Joi.string().required(),
      answer: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, question, answer } = value
    new Faqs()
      .insertOne({
        customerId,
        question,
        answer,
        createdAt: moment().format()
      }).then(faq => res.json(faq))
      .catch(() => res.status(403).end())
  }

  patch (req, res) {
    const data = req.body
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      faqId: Joi.string().required(),
      question: Joi.string().required(),
      answer: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, faqId, question, answer } = value
    new Faqs()
      .updateOne(
        { _id: ObjectId(faqId), customerId },
        { $set: { question, answer } },
        { returnOriginal: false }
      ).then(faq => res.json(faq))
      .catch(() => res.status(403).end())
  }

  search (req, res) {
    const { keyword } = req.query
    const { customerId } = req.body
    this.collectFaqs({ customerId })
      .then(result => {
        const fuse = new Fuse(result, { keys: ['question', 'answer'] })
        result = fuse.search(keyword)
        result = result.slice(0, 5)
        res.json(result)
      }).catch(() => res.status(403).end())
  }
}

module.exports = FaqsController
