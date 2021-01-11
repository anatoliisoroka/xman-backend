const _ = require('lodash')
const faker = require('faker')
const moment = require('moment')
const mongodb = require('../driver')
const randomColor = require('randomcolor')

mongodb.connect()
  .then(connect => {
    connect.db.collection('teammates')
      .find()
      .toArray()
      .then(teammates => {
        teammates.forEach(teammate => generate(teammate))
      })
      .catch(error => console.log('Error', error))

    function generate(teammate) {
      const teammateId = teammate._id.toString()
      const customerId = teammate.customerId
      const count = _.random(1, 5)
      
      _.forEach(_.range(count), loop => {
        connect.db.collection('contacts')
          .insertOne({
            customerId,
            teammateId,
            whatsapp: _.random(000, 999),
            name: faker.name.findName(),
            email: faker.internet.email(),
            charPhotoColor: randomColor({ hue: 'random', luminosity: 'dark', format: 'hex' }),
            isArchived: faker.random.boolean(),
            createdAt: moment().format()
          })
          .then(() => {
            if (loop === (count - 1)) console.log('Seeded! 🎉')
            connect.close()
          })
          .catch(error => console.log('Error', error))
      })
    }
  }).catch(error => console.log('Error', error))
