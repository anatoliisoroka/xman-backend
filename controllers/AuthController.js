require('dotenv').config()
const Joi = require('joi')
const { formatJoiError } = require('../helpers')
const _ = require('lodash')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const Controller = require('./Controller')
const { Customers, Teammates } = require('../model')

class AuthController extends Controller {
  collectTeammate (query) {
    return new Teammates()
      .findOne(query)
  }

  collectCustomer (customerId) {
    const query = { _id: super.oid(customerId) }
    return new Customers()
      .findOne(query)
  }

  signIn (req, res) {
    const { body: data } = req
    const schema = {
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { email, password } = value
    const query = { email }
    this.collectTeammate(query)
      .then(teammate => {
        if (_.isEmpty(teammate)) throw new Error()
        const { _id, customerId, isCustomer } = teammate
        const isValidPassword = bcrypt.compareSync(password, teammate.password)
        if (!isValidPassword) throw new Error()
        this.collectCustomer(customerId)
          .then(customer => {
            const signData = {
              teammateId: _id.toString(),
              customerId,
              isCustomer
            }
            const token = jwt.sign(signData, process.env.SECRET_KEY)
            res.cookie('teammateId', _id.toString())
            res.cookie('customerId', customerId)
            res.cookie('lang', customer.lang ? customer.lang : 'en')
            res.cookie('token', token, { httpOnly: true }).json(signData)
          }).catch(() => res.status(422).json({ error: 'invalid_sign_in_credentials' }))
      }).catch(() => res.status(422).json({ error: 'invalid_sign_in_credentials' }))
  }

  signOut (req, res) {
    res.clearCookie('token', { httpOnly: true })
    res.clearCookie('customerId')
    res.clearCookie('teammateId')
    res.end()
  }

  check (req, res) {
    const { teammateId } = req.body
    const query = { _id: super.oid(teammateId) }
    this.collectTeammate(query)
      .then(teammate => {
        const { isCustomer } = teammate
        res.json({ auth: true, isCustomer })
      }).catch(() => res.status(403).end())
  }
}

module.exports = AuthController
