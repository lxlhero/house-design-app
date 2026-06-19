const API = '/api'

async function request(url, options = {}) {
  const res = await fetch(`${API}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  return res.json()
}

export const api = {
  // Dashboard
  overview: () => request('/dashboard/overview'),
  categories: () => request('/dashboard/categories'),
  phases: () => request('/dashboard/phases'),
  floors: () => request('/dashboard/floors'),
  importLogs: () => request('/dashboard/import-logs'),

  // Items
  items: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/items?${qs}`)
  },
  item: (id) => request(`/items/${id}`),
  updateItem: (id, data) => request(`/items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  batchUpdateStatus: (ids, status) => request('/items/batch/status', {
    method: 'PATCH',
    body: JSON.stringify({ ids, status }),
  }),
  filterOptions: () => request('/items/filters'),

  // Import
  importExcel: async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API}/import/excel`, {
      method: 'POST',
      body: formData,
    })
    return res.json()
  },

  // Budget config
  updateBudget: (totalBudget) => request('/dashboard/budget', {
    method: 'PATCH',
    body: JSON.stringify({ total_budget: totalBudget }),
  }),
}
