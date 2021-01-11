
const Joi = require('joi')
const _ = require('lodash')
const moment = require('moment')
const Controller = require('./Controller')
const { formatJoiError } = require('../helpers')
const { Teammates, AssignmentRules } = require('../model')

class AssignmentRulesController extends Controller {
  collectAssignee (assignmentRule) {
    const { assigneeId } = assignmentRule
    const query = { _id: super.oid(assigneeId) }
    const options = { projection: { password: false } }
    return new Promise((resolve, reject) => {
      new Teammates()
        .findOne(query, options)
        .then(assignee => {
          _.assign(assignmentRule, { assignee })
          resolve(assignmentRule)
        }).catch(error => reject(error))
    })
  }

  collectAssigned (assignmentRule) {
    const { value: assignedId, category, condition } = assignmentRule
    const isContactCategory = (category === 'contact')
    const isConditonAssignTo = (condition === 'assignTo')
    if (isContactCategory && isConditonAssignTo) {
      const query = { _id: super.oid(assignedId) }
      const options = { projection: { password: false } }
      return new Promise((resolve, reject) => {
        return new Teammates()
          .findOne(query, options)
          .then(assigned => {
            _.assign(assignmentRule, { assigned })
            resolve(assignmentRule)
          }).catch(error => reject(error))
      })
    } else return Promise.resolve(assignmentRule)
  }

  create (req, res) {
    const { body: data } = req
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.string().allow(),
      assigneeId: Joi.string().required(),
      name: Joi.string().required(),
      category: Joi.string().required(),
      condition: Joi.string().required(),
      value: Joi.string().required()
    }
    const { error, value: result } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, assigneeId, name, category, condition, value } = result
    const insertAssignmentRules = () => {
      const assignmentRule = {
        customerId,
        assigneeId,
        name,
        category,
        condition,
        value,
        isActive: true,
        createdAt: moment().format()
      }
      return new AssignmentRules()
        .insertOne(assignmentRule)
    }
    insertAssignmentRules()
      .then(assignmentRule => {
        this.collectAssignee(assignmentRule)
          .then(assignmentRule => {
            this.collectAssigned(assignmentRule)
              .then(assignmentRule => res.json(assignmentRule))
              .catch(() => res.status(403).end())
          }).catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  index (req, res) {
    const { customerId } = req.body
    const collectAssignmentRules = () => {
      return new AssignmentRules()
        .find({ customerId })
    }
    const collectAllAssignee = (assignmentRules) => {
      return assignmentRules.map(assignmentRule => this.collectAssignee(assignmentRule))
    }
    const collectAllAssigned = (assignmentRules) => {
      return assignmentRules.map(assignmentRule => this.collectAssigned(assignmentRule))
    }
    collectAssignmentRules()
      .then(assignmentRules => {
        Promise.all(collectAllAssignee(assignmentRules))
          .then(assignmentRules => {
            Promise.all(collectAllAssigned(assignmentRules))
              .then(assignmentRules => res.json(assignmentRules))
              .catch(() => res.status(403).end())
          }).catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  update (req, res) {
    const { body: data } = req
    const { assignmentRuleId } = req.params
    _.assign(data, { assignmentRuleId })
    const schema = {
      assignmentRuleId: Joi.string().required(),
      customerId: Joi.string().required(),
      teammateId: Joi.string().allow(),
      assigneeId: Joi.string().required(),
      name: Joi.string().required(),
      category: Joi.string().required(),
      condition: Joi.string().required(),
      value: Joi.string().required()
    }
    const { error, value: result } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { assigneeId, name, category, condition, value } = result
    const query = { _id: super.oid(assignmentRuleId) }
    const update = { $set: { assigneeId, name, category, condition, value } }
    const options = { returnOriginal: false }
    return new AssignmentRules()
      .updateOne(query, update, options)
      .then(assignmentRule => {
        this.collectAssignee(assignmentRule)
          .then(assignmentRule => {
            this.collectAssigned(assignmentRule)
              .then(assignmentRule => res.json(assignmentRule))
              .catch(() => res.status(403).end())
          }).catch(() => res.status(403).end())
      }).catch(() => res.status(403).end())
  }

  delete (req, res) {
    const { body: data } = req
    const { assignmentRuleId } = req.params
    _.assign(data, { assignmentRuleId })
    const schema = {
      assignmentRuleId: Joi.string().required(),
      customerId: Joi.string().required(),
      teammateId: Joi.string().allow()
    }
    const { error } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    new AssignmentRules()
      .deleteOne({ _id: super.oid(assignmentRuleId) })
      .then(() => res.status(200).end())
      .catch(() => res.status(403).end())
  }

  switchAvailability (req, res) {
    const { body: data } = req
    const { assignmentRuleId } = req.params
    _.assign(data, { assignmentRuleId })
    const schema = {
      customerId: Joi.string().required(),
      teammateId: Joi.allow(),
      assignmentRuleId: Joi.string().required(),
      isActive: Joi.boolean().required()
    }
    const { error, value } = Joi.validate(data, schema)
    if (error) return res.status(422).json({ error: formatJoiError(error) })
    const { customerId, assignmentRuleId: id, isActive } = value
    const query = { customerId, _id: super.oid(id) }
    const status = { $set: { isActive } }
    const options = { returnOriginal: false }
    return new AssignmentRules()
      .updateOne(query, status, options)
      .then(() => res.json({ isActive }))
      .catch(() => res.status(403).end())
  }
}

module.exports = AssignmentRulesController
