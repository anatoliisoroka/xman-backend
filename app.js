const express = require('express')
require('dotenv').config()
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const admin = require('firebase-admin')
const apiRouter = require('./routes')
const { MongoDB, Redis } = require('./services')
const serviceCredentials = require('./serviceCredentials.json')

const app = express()
const origin = (process.env.PORT === '80')
  ? `${process.env.PROTOCOL}://${process.env.HOST}`
  : `${process.env.PROTOCOL}://${process.env.HOST}:${process.env.PORT}`

app.use(cors({
  origin,
  credentials: true
}))
app.use(bodyParser.json({ limit: process.env.PAYLOAD_LIMIT }))
app.use(cookieParser())

function initFirebaseAdmin () {
  admin.initializeApp({
    credential: admin.credential.cert(serviceCredentials),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  })
}

MongoDB.connect()
  .then(() => {
    Redis.connect()
    initFirebaseAdmin()
    app.use('/', apiRouter)
    app.listen(process.env.API_PORT)
    process.on('SIGINT', () => {
      MongoDB.close()
    })
  }).catch(err => console.error(err))
