const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const Joi = require('joi')
const { google } = require('googleapis')
const ObjectId = require('mongodb').ObjectID
const Controller = require('./Controller')
const { formatJoiError } = require('../helpers')
const { Customers } = require('../model')

class GmailApiController extends Controller {
  oAuth2Client () {
    return new Promise((resolve, reject) => {
      fs.readFile(path.join(__dirname, '../../credentials.json'), (error, content) => {
        if (error) return reject(error)
        const credentials = JSON.parse(content)
        const { client_secret, client_id, redirect_uris } = credentials.web
        const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
        resolve(oAuth2Client)
      })
    })
  }

  authCheck (req, res) {
    const { customerId } = req.body
    if (_.isEmpty(customerId)) return res.status(403).end()
    function collectAccessToken () {
      const query = { _id: ObjectId(customerId) }
      const options = { projection: { gmailAccessToken: 1 } }
      return new Customers().findOne(query, options)
    }
    collectAccessToken()
      .then(token => {
        const { gmailAccessToken } = token
        const isGmailAuth = !_.isEmpty(gmailAccessToken)
        res.json({ isGmailAuth })
      }).catch(() => res.status(403).end())
  }

  authUrl (req, res) {
    this.oAuth2Client()
      .then(oAuth2Client => {
        const authUrl = oAuth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: [
            'https://www.googleapis.com/auth/gmail.modify',
            'https://www.googleapis.com/auth/contacts.readonly'
          ]
        })
        res.json({ authUrl })
      }).catch(() => res.status(403).end())
  }

  token () {
    const update = (req, res) => {
      const data = req.body
      const schema = {
        customerId: Joi.string().required(),
        teammateId: Joi.allow(),
        code: Joi.string().required()
      }
      const { error, value } = Joi.validate(data, schema)
      if (error) return res.status(422).json({ error: formatJoiError(error) })
      var { customerId, code } = value
      function updateToken (gmailAuthToken, gmailAccessToken, gmailRefreshToken) {
        const query = { _id: ObjectId(customerId) }
        const data = { $set: { gmailAuthToken, gmailAccessToken, gmailRefreshToken } }
        return new Customers().updateOne(query, data)
      }
      this.oAuth2Client()
        .then(oAuth2Client => {
          oAuth2Client.getToken(code)
            .then(response => {
              const { access_token, refresh_token } = response.tokens
              updateToken(code, access_token, refresh_token)
                .then(() => res.end())
                .catch(() => res.status(403).end())
            }).catch(() => res.status(403).end())
        }).catch(() => res.status(403).end())
    }
    return { update }
  }
}

module.exports = GmailApiController
