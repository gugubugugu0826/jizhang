// ============================================================
// 记账APP — 两级分类数据
// ============================================================
import type { Category } from './types'

export const CATEGORIES: Category[] = [
  {
    id: 'food',
    name: '餐饮美食',
    icon: '🍽️',
    children: [
      { id: 'breakfast', name: '早餐' },
      { id: 'lunch', name: '午餐' },
      { id: 'dinner', name: '晚餐' },
      { id: 'snacks', name: '零食饮料' },
      { id: 'takeout', name: '外卖' },
      { id: 'gathering', name: '聚餐' }
    ]
  },
  {
    id: 'transport',
    name: '交通出行',
    icon: '🚗',
    children: [
      { id: 'transit', name: '公交地铁' },
      { id: 'taxi', name: '网约车' },
      { id: 'fuel', name: '加油充电' },
      { id: 'parking', name: '停车费' },
      { id: 'train_flight', name: '火车飞机' },
      { id: 'car_maintenance', name: '汽车保养' }
    ]
  },
  {
    id: 'shopping',
    name: '购物消费',
    icon: '🛒',
    children: [
      { id: 'clothing', name: '服饰鞋包' },
      { id: 'daily', name: '日用品' },
      { id: 'electronics', name: '数码电子' },
      { id: 'homegoods', name: '家居用品' },
      { id: 'beauty', name: '个护美妆' }
    ]
  },
  {
    id: 'housing',
    name: '住房生活',
    icon: '🏠',
    children: [
      { id: 'rent', name: '房租房贷' },
      { id: 'utilities', name: '水电燃气' },
      { id: 'property', name: '物业费' },
      { id: 'repair', name: '维修保养' },
      { id: 'home_daily', name: '居家日用' }
    ]
  },
  {
    id: 'entertainment',
    name: '娱乐休闲',
    icon: '🎮',
    children: [
      { id: 'movie', name: '电影演出' },
      { id: 'fitness', name: '运动健身' },
      { id: 'gaming', name: '游戏充值' },
      { id: 'travel', name: '旅游度假' },
      { id: 'pet', name: '宠物花费' }
    ]
  },
  {
    id: 'health',
    name: '医疗健康',
    icon: '🏥',
    children: [
      { id: 'medical', name: '看病购药' },
      { id: 'checkup', name: '体检检查' },
      { id: 'supplements', name: '保健品' },
      { id: 'medical_device', name: '医疗器械' }
    ]
  },
  {
    id: 'education',
    name: '教育学习',
    icon: '📚',
    children: [
      { id: 'course', name: '课程培训' },
      { id: 'books', name: '书籍文具' },
      { id: 'exam', name: '考试报名' },
      { id: 'study_tools', name: '学习工具' }
    ]
  },
  {
    id: 'social',
    name: '人情往来',
    icon: '🎁',
    children: [
      { id: 'red_packet', name: '红包礼金' },
      { id: 'treating', name: '请客吃饭' },
      { id: 'family', name: '孝敬长辈' },
      { id: 'gift', name: '节日礼物' }
    ]
  },
  {
    id: 'finance',
    name: '金融保险',
    icon: '💼',
    children: [
      { id: 'insurance', name: '保险费' },
      { id: 'loan_interest', name: '贷款利息' },
      { id: 'service_fee', name: '手续费' },
      { id: 'investment_loss', name: '投资亏损' }
    ]
  },
  {
    id: 'other',
    name: '其他支出',
    icon: '📦',
    children: [
      { id: 'delivery', name: '快递物流' },
      { id: 'fine', name: '罚款缴费' },
      { id: 'misc', name: '其他杂项' }
    ]
  }
]

/** 快速查找：根据分类ID获取分类信息 */
export function getCategoryInfo(category1: string, category2: string): {
  category1Name: string
  category1Icon: string
  category2Name: string
} | null {
  const cat1 = CATEGORIES.find(c => c.id === category1)
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
  return CATEGORIES.map(c => ({ value: c.id, label: c.name, icon: c.icon }))
}

/** 根据一级分类ID获取二级分类选项 */
export function getCategory2Options(category1: string): { value: string; label: string }[] {
  const cat = CATEGORIES.find(c => c.id === category1)
  if (!cat) return []
  return cat.children.map(c => ({ value: c.id, label: c.name }))
}
