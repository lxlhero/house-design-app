const API = '/api'

function getToken() {
  return localStorage.getItem('house_token') || ''
}

async function request(url, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }
  const res = await fetch(`${API}${url}`, { ...options, headers })
  if (res.status === 401) {
    localStorage.removeItem('house_token')
    window.location.href = '/login'
    throw new Error('未登录')
  }
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

  // Phase advancement
  advancePhase: (id) => request(`/dashboard/phases/${id}/advance`, { method: 'PATCH' }),
}
