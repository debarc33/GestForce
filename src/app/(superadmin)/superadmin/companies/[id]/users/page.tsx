'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Plus, Trash2, X } from 'lucide-react'

type CompanyUser = {
  id: string
  user_id: string
  role: string
  created_at: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  contador: 'Contador',
  vendedor: 'Vendedor',
  readonly: 'Solo lectura',
}

export default function CompanyUsersPage() {
  const params = useParams()
  const companyId = params.id as string

  const [users, setUsers] = useState<CompanyUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newUser, setNewUser] = useState({ email: '', role: 'admin' })

  useEffect(() => {
    fetchUsers()
  }, [companyId])

  async function fetchUsers() {
    try {
      setLoading(true)
      const res = await fetch(`/api/superadmin/companies/${companyId}/users`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setUsers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  async function createUser() {
    if (!newUser.email.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/superadmin/companies/${companyId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setShowCreate(false)
      setNewUser({ email: '', role: 'admin' })
      fetchUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function deleteUser(userId: string) {
    if (!confirm('¿Eliminar usuario?')) return
    try {
      const res = await fetch(`/api/superadmin/companies/${companyId}/users?userId=${userId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Error')
      fetchUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <div className='space-y-6'>
      <div className='flex justify-between items-center'>
        <h2 className='text-xl font-bold text-white'>Usuarios</h2>
        <button onClick={() => setShowCreate(true)} className='flex gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-500'>
          <Plus className='h-4 w-4' /> Nuevo
        </button>
      </div>
      {error && <div className='text-red-400 p-4 rounded-xl bg-red-900/20'>{error}</div>}
      <div className='rounded-2xl border border-zinc-800 bg-zinc-900'>
        {loading ? (
          <div className='py-16 text-center'><Loader2 className='animate-spin mx-auto' /></div>
        ) : users.length === 0 ? (
          <div className='py-16 text-center text-zinc-500'>Sin usuarios</div>
        ) : (
          <>
            <div className='grid grid-cols-3 px-6 py-4 border-b border-zinc-800 text-xs font-semibold text-zinc-500'>
              <span>Usuario</span>
              <span>Rol</span>
              <span className='text-right'>Eliminar</span>
            </div>
            <div className='divide-y divide-zinc-800'>
              {users.map((u) => (
                <div key={u.id} className='grid grid-cols-3 px-6 py-4 hover:bg-zinc-800/30'>
                  <span className='text-sm text-zinc-300'>{u.user_id.substring(0, 12)}...</span>
                  <span className='text-sm'>{ROLE_LABELS[u.role] || u.role}</span>
                  <button onClick={() => deleteUser(u.user_id)} className='text-right text-red-400 hover:text-red-300'><Trash2 className='h-4 w-4 ml-auto' /></button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      {showCreate && (
        <div className='fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4'>
          <div className='w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6'>
            <div className='flex justify-between items-center mb-5'>
              <h2 className='text-lg font-bold text-white'>Nuevo usuario</h2>
              <button onClick={() => setShowCreate(false)} className='text-zinc-500'><X className='h-5 w-5' /></button>
            </div>
            <div className='space-y-4'>
              <div>
                <label className='text-xs font-medium text-zinc-400 mb-1 block'>Email</label>
                <input type='email' placeholder='usuario@email.com' value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} className='w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-white text-sm' />
              </div>
              <div>
                <label className='text-xs font-medium text-zinc-400 mb-1 block'>Rol</label>
                <select value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value})} className='w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-white text-sm'>
                  <option value='admin'>Admin</option>
                  <option value='contador'>Contador</option>
                  <option value='vendedor'>Vendedor</option>
                  <option value='readonly'>Lectura</option>
                </select>
              </div>
            </div>
            <div className='mt-6 flex gap-3'>
              <button onClick={() => setShowCreate(false)} className='flex-1 border border-zinc-700 py-2 text-sm text-zinc-400 rounded-xl hover:bg-zinc-800'>Cancelar</button>
              <button onClick={createUser} disabled={saving || !newUser.email.trim()} className='flex-1 bg-indigo-600 py-2 text-white text-sm rounded-xl hover:bg-indigo-500 disabled:opacity-50 flex gap-2 items-center justify-center'>{saving && <Loader2 className='h-4 w-4 animate-spin' />}Crear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}