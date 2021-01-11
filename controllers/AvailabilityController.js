const Controller = require('./Controller')
const { Customers } = require('../model')

class AvailabilityController extends Controller {
  collectCustomer (customerId) {
    const query = { _id: super.oid(customerId) }
    return new Customers()
      .findOne(query)
  }

  switch (req, res) {
    const { customerId } = req.body
    this.collectCustomer(customerId)
      .then(customer => {
        var { isAvailable } = customer
        isAvailable = !isAvailable
        const query = { _id: super.oid(customerId) }
        const update = { $set: { isAvailable } }
        new Customers()
          .updateOne(query, update)
          .then(() => res.status(200).json({ isAvailable }))
          .catch(() => res.status(403).json({ error: 'something_went_wrong' }))
      }).catch(() => res.status(403).json({ error: 'something_went_wrong' }))
  }

  get (req, res) {
    const { customerId } = req.body
    this.collectCustomer(customerId)
      .then(customer => res.json(customer.isAvailable))
      .catch(() => res.status(403).end())
  }
}

module.exports = AvailabilityController
