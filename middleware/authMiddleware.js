const jwt = require('jsonwebtoken')
const Joi = require('joi')
require('dotenv').config()

function auth (req, res, next) {
  const cookies = req.cookies
  const schema = Joi.object().keys({
    token: Joi.string().required(),
    customerId: Joi.string().required(),
    teammateId: Joi.string().required()
  }).unknown(true)

  const { error, value } = Joi.validate(cookies, schema)
  function unauthorized () {
    res.cookie('token', null, { httpOnly: true })
    res.cookie('customerId', null)
    res.cookie('teammateId', null)
    res.status(403).json({ error: 'unauthorized_access' })
  }

  if (error) return unauthorized()
  const { token, customerId, teammateId } = value

  jwt.verify(token, process.env.SECRET_KEY, (error, decoded) => {
    if (error) return unauthorized()
    const isValidCustomerId = customerId == decoded.customerId
    const isValidTeammateId = teammateId == decoded.teammateId
    if (!isValidCustomerId || !isValidTeammateId) return unauthorized()

    req.body.customerId = decoded.customerId
    req.body.teammateId = decoded.teammateId
    next()
  })
}

module.exports = auth
