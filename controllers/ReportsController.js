const _ = require('lodash')
const moment = require('moment')
const Controller = require('./Controller')
const { Contacts, Conversations, Teammates, Broadcasts, Keywords, Sequences } = require('../model')

class ReportsController extends Controller {
  counters (req, res) {
    const customerId = req.body.customerId
    const contacts = new Contacts().count({ customerId })
    const conversations = new Conversations().count({ customerId })
    const teammates = new Teammates().count({ customerId, isCustomer: false })
    const keywords = new Keywords().count({ customerId })
    const sequences = new Sequences().count({ customerId })
    const broadcasts = new Broadcasts().count({ customerId })
    Promise.all([contacts, conversations, teammates, keywords, sequences, broadcasts])
      .then(counts => {
        const data = {
          contacts: counts[0],
          conversations: counts[1],
          teammates: counts[2],
          keywords: counts[3],
          sequences: counts[4],
          broadcasts: counts[5]
        }
        res.json(data)
      }).catch(() => res.status(403).end())
  }

  weeklyConversations (req, res) {
    const customerId = req.body.customerId
    function collectConversations () {
      const query = { customerId, createdAt: { $gte: moment().subtract(1, 'week').format(), $lte: moment().format() } }
      return new Conversations()
        .find(query)
    }
    collectConversations()
      .then(convs => {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        convs.forEach(conv => {
          conv.day = moment(conv.createdAt).format('ddd')
        })
        convs = _.groupBy(convs, 'day')
        const counts = days.map(day => convs[day] ? convs[day].length : 0)
        res.json({ days, counts })
      }).catch(() => res.status(403).end())
  }
}

module.exports = ReportsController
