import { useState, useEffect } from 'react'
import { Card, Table, Button, Input, Space, Popconfirm, message, Modal, Tag } from 'antd'
import { PlusOutlined, DeleteOutlined, EditOutlined, CheckOutlined, CloseOutlined, LockOutlined } from '@ant-design/icons'
import type { Category } from '../../../shared/types'

export default function CategoryManagePage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  // 添加大类
  const [addMainOpen, setAddMainOpen] = useState(false)
  const [newMainName, setNewMainName] = useState('')
  const [newMainIcon, setNewMainIcon] = useState('📦')
  // 添加小类
  const [addSubParent, setAddSubParent] = useState<string | null>(null)
  const [newSubName, setNewSubName] = useState('')
  // 编辑
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('')

  useEffect(() => { loadCategories() }, [])

  const loadCategories = async () => {
    setLoading(true)
    try {
      const cats = await window.api.getCategories()
      setCategories(cats)
    } catch { message.error('加载失败') }
    finally { setLoading(false) }
  }

  // ======== 大类操作 ========
  const handleAddMain = async () => {
    if (!newMainName.trim()) return
    try {
      const result = await window.api.addCategory(newMainName.trim(), newMainIcon.trim() || '📦', null)
      if (result.success) {
        message.success('大类添加成功')
        setAddMainOpen(false)
        setNewMainName('')
        setNewMainIcon('📦')
        loadCategories()
      } else {
        message.error(result.error || '添加失败')
      }
    } catch { message.error('添加失败') }
  }

  // ======== 小类操作 ========
  const handleAddSub = async (parentId: string) => {
    if (!newSubName.trim()) return
    try {
      const result = await window.api.addCategory(newSubName.trim(), '', parentId)
      if (result.success) {
        message.success('小类添加成功')
        setAddSubParent(null)
        setNewSubName('')
        loadCategories()
      } else {
        message.error(result.error || '添加失败')
      }
    } catch { message.error('添加失败') }
  }

  // ======== 编辑 ========
  const startEdit = (cat: { id: string; name: string; icon?: string }) => {
    setEditingId(cat.id)
    setEditName(cat.name)
    setEditIcon(cat.icon || '')
  }

  const handleEdit = async (id: string) => {
    if (!editName.trim()) return
    try {
      const result = await window.api.updateCategory(id, editName.trim(), editIcon.trim())
      if (result.success) {
        message.success('修改成功')
        setEditingId(null)
        loadCategories()
      } else {
        message.error(result.error || '修改失败')
      }
    } catch { message.error('修改失败') }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditIcon('')
  }

  // ======== 删除 ========
  const handleDelete = async (id: string) => {
    try {
      const result = await window.api.deleteCategory(id)
      if (result.success) {
        message.success('删除成功')
        loadCategories()
      } else {
        message.error(result.error || '删除失败')
      }
    } catch { message.error('删除失败') }
  }

  // ======== 表格列 ========

  const mainColumns = [
    {
      title: '分类',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Category) => {
        const isEditing = editingId === record.id
        if (isEditing) {
          return (
            <Space>
              <Input
                value={editIcon}
                onChange={e => setEditIcon(e.target.value)}
                style={{ width: 50 }}
                maxLength={4}
                placeholder="图标"
              />
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onPressEnter={() => handleEdit(record.id)}
                style={{ width: 180 }}
                autoFocus
              />
            </Space>
          )
        }
        return (
          <span style={{ fontSize: 15, fontWeight: 500 }}>
            {record.icon} {name}
            {record.isSystem && <LockOutlined style={{ marginLeft: 8, color: '#999', fontSize: 13 }} />}
          </span>
        )
      }
    },
    {
      title: '小类数量',
      key: 'subCount',
      width: 100,
      render: (_: any, record: Category) => (
        <Tag>{record.children?.length ?? 0} 个小类</Tag>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_: any, record: Category) => {
        const isEditing = editingId === record.id
        if (isEditing) {
          return (
            <Space>
              <Button type="link" icon={<CheckOutlined />} onClick={() => handleEdit(record.id)} />
              <Button type="link" icon={<CloseOutlined />} onClick={cancelEdit} />
            </Space>
          )
        }
        return (
          <Space>
            {!record.isSystem && (
              <>
                <Button type="link" icon={<EditOutlined />} onClick={() => startEdit(record)}>
                  编辑
                </Button>
                <Popconfirm
                  title="确认删除"
                  description={`确定要删除大类「${record.name}」吗？其下所有小类也会被删除。`}
                  onConfirm={() => handleDelete(record.id)}
                  okText="删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                >
                  <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
                </Popconfirm>
              </>
            )}
            <Button type="link" onClick={() => {
              cancelEdit()
              setAddSubParent(record.id)
              setNewSubName('')
            }}>
              + 添加小类
            </Button>
          </Space>
        )
      }
    }
  ]

  // 展开的子表格
  const expandedRowRender = (record: Category) => {
    const subColumns = [
      {
        title: '小类名称',
        dataIndex: 'name',
        key: 'name',
        render: (name: string, sub: any) => {
          const isEditing = editingId === sub.id
          if (isEditing) {
            return (
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onPressEnter={() => handleEdit(sub.id)}
                style={{ width: 200 }}
                autoFocus
              />
            )
          }
          return (
            <span style={{ paddingLeft: 24 }}>
              {name}
              {sub.isSystem && <LockOutlined style={{ marginLeft: 8, color: '#999', fontSize: 12 }} />}
            </span>
          )
        }
      },
      {
        title: '来源',
        key: 'source',
        width: 80,
        render: (_: any, sub: any) => (
          <Tag color={sub.isSystem ? 'blue' : 'green'}>{sub.isSystem ? '系统' : '自定义'}</Tag>
        )
      },
      {
        title: '操作',
        key: 'actions',
        width: 160,
        render: (_: any, sub: any) => {
          const isEditing = editingId === sub.id
          if (isEditing) {
            return (
              <Space>
                <Button type="link" icon={<CheckOutlined />} onClick={() => handleEdit(sub.id)} />
                <Button type="link" icon={<CloseOutlined />} onClick={cancelEdit} />
              </Space>
            )
          }
          if (sub.isSystem) return <span style={{ color: '#999', fontSize: 12 }}>不可编辑</span>
          return (
            <Space>
              <Button type="link" icon={<EditOutlined />} onClick={() => startEdit(sub)} />
              <Popconfirm
                title="确认删除"
                description={`确定要删除小类「${sub.name}」吗？`}
                onConfirm={() => handleDelete(sub.id)}
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
      <Table
        dataSource={record.children}
        columns={subColumns}
        rowKey="id"
        pagination={false}
        size="small"
        showHeader={false}
      />
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={`🏷️ 分类管理（共 ${categories.length} 个大类）`}
        extra={
          <Button type="primary" icon={<PlusOutlined />}
            onClick={() => { cancelEdit(); setAddMainOpen(true); setNewMainName(''); setNewMainIcon('📦') }}>
            添加大类
          </Button>
        }
      >
        <Table
          dataSource={categories}
          columns={mainColumns}
          rowKey="id"
          loading={loading}
          pagination={false}
          expandable={{ expandedRowRender, defaultExpandAllRows: false }}
          locale={{ emptyText: '暂无分类' }}
          style={{ marginTop: 8 }}
        />
      </Card>

      {/* 添加大类弹窗 */}
      <Modal
        title="添加新大类"
        open={addMainOpen}
        onOk={handleAddMain}
        onCancel={() => setAddMainOpen(false)}
        okText="添加"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>图标（emoji）</div>
          <Input
            value={newMainIcon}
            onChange={e => setNewMainIcon(e.target.value)}
            style={{ width: 80, fontSize: 24, textAlign: 'center' }}
            maxLength={4}
          />
        </div>
        <div>
          <div style={{ marginBottom: 6, fontWeight: 500 }}>分类名称</div>
          <Input
            value={newMainName}
            onChange={e => setNewMainName(e.target.value)}
            onPressEnter={handleAddMain}
            placeholder="例如：宠物用品"
            maxLength={20}
            autoFocus
          />
        </div>
      </Modal>

      {/* 添加小类弹窗 */}
      <Modal
        title="添加新小类"
        open={addSubParent !== null}
        onOk={() => addSubParent && handleAddSub(addSubParent)}
        onCancel={() => setAddSubParent(null)}
        okText="添加"
        cancelText="取消"
      >
        <div style={{ marginBottom: 6, fontWeight: 500 }}>小类名称</div>
        <Input
          value={newSubName}
          onChange={e => setNewSubName(e.target.value)}
          onPressEnter={() => addSubParent && handleAddSub(addSubParent)}
          placeholder="例如：奶茶咖啡"
          maxLength={20}
          autoFocus
        />
      </Modal>
    </div>
  )
}
