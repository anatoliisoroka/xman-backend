const MongoDB = require('../services/MongoDBService')

class Model {
  constructor () {
    this.db = MongoDB.get()
  }
  collection (collection) {
    return this.db.collection(collection)
  }
  find (collection, query, options) {
    return this.collection(collection)
      .find(query, options)
      .toArray()
  }
  paginate (collection, query, skip, limit) {
    return this.collection(collection)
      .find(query)
      .sort( { createdAt: -1 } )
      .skip(skip)
      .limit(limit)
      .toArray()
  }
  findOne (collection, query, options) {
    return this.collection(collection)
      .findOne(query, options)
  }
  count (collection, query) {
    return this.collection(collection)
      .find(query)
      .count()
  }
  insertOne (collection, data) {
    return new Promise((resolve, reject) => {
      this.collection(collection)
        .insertOne(data)
        .then(result => resolve(result.ops[0]))
        .catch(error => reject(error))
    })
  }
  updateOne (collection, query, data, options) {
    return new Promise((resolve, reject) => {
      this.collection(collection)
        .findOneAndUpdate(query, data, options)
        .then(result => {
          resolve(result.value)
        }).catch(error => reject(error))
    })
  }
  updateMany (collection, query, data) {
    return new Promise((resolve, reject) => {
      this.collection(collection)
        .updateMany(query, data)
        .then(result => resolve(result.ops))
        .catch(error => reject(error))
    })
  }
  deleteOne (collection, query) {
    return new Promise((resolve, reject) => {
      this.collection(collection)
        .findOneAndDelete(query)
        .then(result => resolve(result.value))
        .catch(error => reject(error))
    })
  }
  deleteMany (collection, query) {
    return this.collection(collection)
      .deleteMany(query)
  }
}

module.exports = Model
