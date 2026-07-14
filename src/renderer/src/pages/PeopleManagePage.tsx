import { useState, useEffect } from 'react'
import { Card, Table, Button, Input, Space, Popconfirm, message } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons'
import type { Person } from '../../../shared/types'

export default function PeopleManagePage() {
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    loadPeople()
  }, [])

  const loadPeople = async () => {
    setLoading(true)
    try {
      const p = await window.api.getPeople()
      setPeople(p)
    } catch (err) {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async () => {
    if (!newName.trim()) return
    try {
      const person = await window.api.addPerson(newName.trim())
      setPeople(prev => [...prev, person])
      setNewName('')
      setAdding(false)
      message.success('添加成功')
    } catch (err) {
      message.error('添加失败')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await window.api.deletePerson(id)
      setPeople(prev => prev.filter(p => p.id !== id))
      message.success('删除成功')
    } catch (err) {
      message.error('删除失败')
    }
  }

  const startEdit = (person: Person) => {
    setEditingId(person.id)
    setEditName(person.name)
  }

  const handleEdit = async (id: number) => {
    if (!editName.trim()) return
    try {
      const updated = await window.api.updatePerson(id, editName.trim())
      if (updated) {
        setPeople(prev => prev.map(p => p.id === id ? updated : p))
        message.success('修改成功')
      }
      setEditingId(null)
    } catch (err) {
      message.error('修改失败')
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
  }

  const columns = [
    {
      title: '序号',
      key: 'index',
      width: 80,
      render: (_: any, __: any, idx: number) => idx + 1
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Person) => {
        if (editingId === record.id) {
          return (
            <Input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onPressEnter={() => handleEdit(record.id)}
              style={{ width: 200 }}
              autoFocus
            />
          )
        }
        return <span style={{ fontSize: 15, fontWeight: 500 }}>{name}</span>
      }
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: any, record: Person) => {
        if (editingId === record.id) {
          return (
            <Space>
              <Button
                type="link"
                icon={<CheckOutlined />}
                onClick={() => handleEdit(record.id)}
              />
              <Button
                type="link"
                icon={<CloseOutlined />}
                onClick={cancelEdit}
              />
            </Space>
          )
        }
        return (
          <Space>
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => startEdit(record)}
            />
            <Popconfirm
              title="确认删除"
              description={`确定要删除「${record.name}」吗？`}
              onConfirm={() => handleDelete(record.id)}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button type="link" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        )
      }
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={`👥 人员管理（共 ${people.length} 人）`}
        extra={
          !adding && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAdding(true)}
            >
              添加人员
            </Button>
          )
        }
      >
        {adding && (
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Input
                placeholder="输入姓名"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onPressEnter={handleAdd}
                style={{ width: 200 }}
                autoFocus
              />
              <Button type="primary" icon={<CheckOutlined />} onClick={handleAdd}>
                确认
              </Button>
              <Button icon={<CloseOutlined />} onClick={() => { setAdding(false); setNewName('') }}>
                取消
              </Button>
            </Space>
          </div>
        )}

        <Table
          dataSource={people}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          locale={{ emptyText: '暂无人员' }}
        />
      </Card>
    </div>
  )
}
