function paginate (result, from) {
  from = Number(from)
  from = from || 0
  const to = from + 20
  const data = result.slice(from, to)
  const total = result.length
  return { data, from, to, total }
}

module.exports = paginate
