const Joi = require('joi')
const _ = require('lodash')
const { formatJoiError } = require('../helpers')
const { CustomFields } = require('../model')
const Controller = require('./Controller')

class CustomFieldsController extends Controller {
  collectCustomFields (query) {
    return new CustomFields().find(query)
  }

  get (req, res) {
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      contactId: Joi.string().required()
    }
    const { error, value } = Joi.validate(req.query, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, contactId } = value
    this.collectCustomFields({ customerId, contactId })
      .then(customFields => res.json(customFields))
      .catch(() => res.status(403).end())
  }

  getAllFields (req, res) {
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow()
    }
    const { error, value } = Joi.validate(req.body, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId } = value
    this.collectCustomFields({ customerId })
      .then(customFields => {
        var fields = customFields.map(customField => customField.field)
        fields = _.uniq(fields)
        res.json(fields)
      }).catch(() => res.status(403).end())
  }
}

module.exports = CustomFieldsController
