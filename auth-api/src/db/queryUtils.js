function unwrapQueryList(result) {
  if (!result) return []

  if (Array.isArray(result)) {
    const first = result[0]
    if (Array.isArray(first)) {
      return first
    }
    if (first && Object.prototype.hasOwnProperty.call(first, 'status')) {
      if (first.status === 'ERR') {
        throw new Error(first.detail || 'SurrealDB query failed')
      }
      const payload = first.result
      if (Array.isArray(payload)) return payload
      return payload ? [payload] : []
    }
    return result
  }

  if (result.status === 'ERR') {
    throw new Error(result.detail || 'SurrealDB query failed')
  }

  const payload = Object.prototype.hasOwnProperty.call(result, 'result') ? result.result : result
  if (Array.isArray(payload)) return payload
  return payload ? [payload] : []
}

function unwrapQueryRecord(result) {
  const list = unwrapQueryList(result)
  return list[0] || null
}

module.exports = { unwrapQueryList, unwrapQueryRecord }
