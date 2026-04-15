// Utility for persisting pricing lists to localStorage

export interface PriceItem {
  name: string
  price: number
  hsn: string
  gst: string
  packing?: string
}

export interface PriceList {
  id: string
  name: string
  supplier: string
  itemCount: number
  uploadedDate: string
  active: boolean
  status: 'draft' | 'submitted'
  items: PriceItem[]
  columns?: string[] // Track available columns
}

const STORAGE_KEY = 'gravity_quoter_price_lists'

export function savePriceLists(lists: PriceList[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists))
  } catch (error) {
    console.error('Failed to save pricing lists:', error)
  }
}

export function loadPriceLists(): PriceList[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch (error) {
    console.error('Failed to load pricing lists:', error)
    return []
  }
}

export function addPriceList(list: PriceList): void {
  const lists = loadPriceLists()
  lists.push(list)
  savePriceLists(lists)
}

export function updatePriceList(id: string, list: PriceList): void {
  const lists = loadPriceLists()
  const index = lists.findIndex(l => l.id === id)
  if (index !== -1) {
    lists[index] = list
    savePriceLists(lists)
  }
}

export function deletePriceList(id: string): void {
  const lists = loadPriceLists()
  const filtered = lists.filter(l => l.id !== id)
  savePriceLists(filtered)
}

export function getPriceListById(id: string): PriceList | undefined {
  const lists = loadPriceLists()
  return lists.find(l => l.id === id)
}

// Search for matching items across multiple price lists with confidence scoring
export interface MatchResult {
  item: PriceItem
  listId: string
  listName: string
  confidence: number // 0-1
  exactMatch: boolean
}

export function searchItems(query: string, listIds: string[]): MatchResult[] {
  const lists = loadPriceLists()
  const results: MatchResult[] = []
  const queryLower = query.toLowerCase()

  for (const list of lists) {
    if (!listIds.includes(list.id)) continue

    for (const item of list.items) {
      const nameLower = item.name.toLowerCase()

      // Exact match
      if (nameLower === queryLower) {
        results.push({
          item,
          listId: list.id,
          listName: list.name,
          confidence: 1.0,
          exactMatch: true
        })
        continue
      }

      // Partial matches
      if (nameLower.includes(queryLower)) {
        // Calculate confidence based on how much of the name matches
        const matchLength = queryLower.length
        const itemLength = nameLower.length
        const confidence = Math.min(0.99, matchLength / itemLength)

        results.push({
          item,
          listId: list.id,
          listName: list.name,
          confidence,
          exactMatch: false
        })
      }
    }
  }

  // Sort by confidence (highest first), then by exactMatch
  results.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return b.confidence - a.confidence
    }
    return b.exactMatch ? 1 : -1
  })

  return results
}

// Find items with the same name across multiple lists
export interface ConflictGroup {
  itemName: string
  matches: MatchResult[]
}

export function findConflicts(listIds: string[]): ConflictGroup[] {
  const lists = loadPriceLists()
  const itemMap = new Map<string, MatchResult[]>()

  for (const list of lists) {
    if (!listIds.includes(list.id)) continue

    for (const item of list.items) {
      const key = item.name.toLowerCase()
      if (!itemMap.has(key)) {
        itemMap.set(key, [])
      }

      itemMap.get(key)!.push({
        item,
        listId: list.id,
        listName: list.name,
        confidence: 1.0,
        exactMatch: true
      })
    }
  }

  // Return only items that appear in multiple lists
  return Array.from(itemMap.entries())
    .filter(([_, matches]) => matches.length > 1)
    .map(([itemName, matches]) => ({
      itemName,
      matches
    }))
}
