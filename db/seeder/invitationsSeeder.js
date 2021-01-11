const faker = require('faker')
const _ = require('lodash')
const shortId = require('shortid')
const moment = require('moment')
const mongodb = require('../driver')

const count = _.random(1, 20)

mongodb.connect()
  .then(connect => {
    _.forEach(_.range(count), loop => {
      connect.db.collection('invitations')
        .insertOne({
          code: shortId.generate(),
          isActive: faker.random.boolean(),
          createdAt: moment().format()
        })
        .then(() => {
          if (loop === (count - 1)) console.log('Seeded! 🎉')
          connect.close()
        })
        .catch(error => console.log('Error', error))
    })
  }).catch(error => console.log('Error', error))
