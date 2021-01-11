const _ = require('lodash')
const Joi = require('joi')
const moment = require('moment-timezone')
const Controller = require('./Controller')
const { formatJoiError } = require('../helpers')
const { ContactRemarks } = require('../model')

class ContactRemarksController extends Controller {
  create (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.string().required(),
      contactId: Joi.string().required(),
      remark: Joi.string().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    var { customerId, contactId, remark, teammateId } = value
    function insertContactRemark () {
      const data = {
        customerId,
        contactId,
        teammateId,
        remark,
        createdAt: moment().format()
      }
      return new ContactRemarks()
        .insertOne(data)
    }
    insertContactRemark()
      .then(contactRemark => res.json(contactRemark))
      .catch(() => res.status(403).end())
  }

  get (req, res) {
    const { customerId } = req.body
    const { contactId } = req.params
    if (_.isEmpty(contactId)) return res.status(403).end()
    const query = { customerId, contactId }
    new ContactRemarks()
      .find(query)
      .then(contactRemarks => {
        contactRemarks = _.orderBy(contactRemarks, 'createdAt', 'desc')
        res.json(contactRemarks)
      }).catch(() => res.status(403).end())
  }
}

module.exports = ContactRemarksController
