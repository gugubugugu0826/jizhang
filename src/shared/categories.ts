// ============================================================
// 记账APP — 两级分类数据（系统预置，仅作种子数据）
// ============================================================
import type { Category } from './types'

export const SYSTEM_CATEGORIES: Category[] = [
  {
    id: 'food',
    name: '餐饮美食',
    icon: '🍽️',
    isSystem: true,
    children: [
      { id: 'breakfast', name: '早餐', isSystem: true },
      { id: 'lunch', name: '午餐', isSystem: true },
      { id: 'dinner', name: '晚餐', isSystem: true },
      { id: 'snacks', name: '零食饮料', isSystem: true },
      { id: 'takeout', name: '外卖', isSystem: true },
      { id: 'gathering', name: '聚餐', isSystem: true }
    ]
  },
  {
    id: 'transport',
    name: '交通出行',
    icon: '🚗',
    isSystem: true,
    children: [
      { id: 'transit', name: '公交地铁', isSystem: true },
      { id: 'taxi', name: '网约车', isSystem: true },
      { id: 'fuel', name: '加油充电', isSystem: true },
      { id: 'parking', name: '停车费', isSystem: true },
      { id: 'train_flight', name: '火车飞机', isSystem: true },
      { id: 'car_maintenance', name: '汽车保养', isSystem: true }
    ]
  },
  {
    id: 'shopping',
    name: '购物消费',
    icon: '🛒',
    isSystem: true,
    children: [
      { id: 'clothing', name: '服饰鞋包', isSystem: true },
      { id: 'daily', name: '日用品', isSystem: true },
      { id: 'electronics', name: '数码电子', isSystem: true },
      { id: 'homegoods', name: '家居用品', isSystem: true },
      { id: 'beauty', name: '个护美妆', isSystem: true }
    ]
  },
  {
    id: 'housing',
    name: '住房生活',
    icon: '🏠',
    isSystem: true,
    children: [
      { id: 'rent', name: '房租房贷', isSystem: true },
      { id: 'utilities', name: '水电燃气', isSystem: true },
      { id: 'property', name: '物业费', isSystem: true },
      { id: 'repair', name: '维修保养', isSystem: true },
      { id: 'home_daily', name: '居家日用', isSystem: true }
    ]
  },
  {
    id: 'entertainment',
    name: '娱乐休闲',
    icon: '🎮',
    isSystem: true,
    children: [
      { id: 'movie', name: '电影演出', isSystem: true },
      { id: 'fitness', name: '运动健身', isSystem: true },
      { id: 'gaming', name: '游戏充值', isSystem: true },
      { id: 'travel', name: '旅游度假', isSystem: true },
      { id: 'pet', name: '宠物花费', isSystem: true }
    ]
  },
  {
    id: 'health',
    name: '医疗健康',
    icon: '🏥',
    isSystem: true,
    children: [
      { id: 'medical', name: '看病购药', isSystem: true },
      { id: 'checkup', name: '体检检查', isSystem: true },
      { id: 'supplements', name: '保健品', isSystem: true },
      { id: 'medical_device', name: '医疗器械', isSystem: true }
    ]
  },
  {
    id: 'education',
    name: '教育学习',
    icon: '📚',
    isSystem: true,
    children: [
      { id: 'course', name: '课程培训', isSystem: true },
      { id: 'books', name: '书籍文具', isSystem: true },
      { id: 'exam', name: '考试报名', isSystem: true },
      { id: 'study_tools', name: '学习工具', isSystem: true }
    ]
  },
  {
    id: 'social',
    name: '人情往来',
    icon: '🎁',
    isSystem: true,
    children: [
      { id: 'red_packet', name: '红包礼金', isSystem: true },
      { id: 'treating', name: '请客吃饭', isSystem: true },
      { id: 'family', name: '孝敬长辈', isSystem: true },
      { id: 'gift', name: '节日礼物', isSystem: true }
    ]
  },
  {
    id: 'finance',
    name: '金融保险',
    icon: '💼',
    isSystem: true,
    children: [
      { id: 'insurance', name: '保险费', isSystem: true },
      { id: 'loan_interest', name: '贷款利息', isSystem: true },
      { id: 'service_fee', name: '手续费', isSystem: true },
      { id: 'investment_loss', name: '投资亏损', isSystem: true }
    ]
  },
  {
    id: 'other',
    name: '其他支出',
    icon: '📦',
    isSystem: true,
    children: [
      { id: 'delivery', name: '快递物流', isSystem: true },
      { id: 'fine', name: '罚款缴费', isSystem: true },
      { id: 'misc', name: '其他杂项', isSystem: true }
    ]
  }
]

/** 快速查找：根据分类ID获取分类信息 */
export function getCategoryInfo(category1: string, category2: string): {
  category1Name: string
  category1Icon: string
  category2Name: string
} | null {
  const cat1 = SYSTEM_CATEGORIES.find(c => c.id === category1)
  if (!cat1) return null
  const cat2 = cat1.children.find(c => c.id === category2)
  if (!cat2) return null
  return {
    category1Name: cat1.name,
    category1Icon: cat1.icon,
    category2Name: cat2.name
  }
}

/** 获取一级分类列表（用于下拉选择） */
export function getCategory1Options(): { value: string; label: string; icon: string }[] {
  return SYSTEM_CATEGORIES.map(c => ({ value: c.id, label: c.name, icon: c.icon }))
}

/** 根据一级分类ID获取二级分类选项 */
export function getCategory2Options(category1: string): { value: string; label: string }[] {
  const cat = SYSTEM_CATEGORIES.find(c => c.id === category1)
  if (!cat) return []
  return cat.children.map(c => ({ value: c.id, label: c.name }))
}
