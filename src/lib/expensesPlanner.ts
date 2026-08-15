export interface PlanSubItem {
  id: string;
  name: string;
  amount: number;
  completed?: boolean;
}

export interface ParsedExpensePlan {
  id: string;
  category: string; // e.g. "Housing"
  name: string;     // e.g. "Apartment Rent"
  amount: number;
  subItems: PlanSubItem[];
  notes?: string;
  rawCategory: string;
}

export interface ParsedIncomeSource {
  id: string;
  name: string;     // e.g. "Main Salary"
  source?: string;  // e.g. "Employer"
  amount: number;
  rawCategory: string;
}

export function isIncomeRow(categoryStr: string): boolean {
  if (!categoryStr) return false;
  return categoryStr.startsWith('__EXPECTED_INCOME__') || categoryStr.includes('"type":"income"');
}

export function isIncomeBudget(categoryStr: string): boolean {
  return isIncomeRow(categoryStr);
}

export function parseIncomeCategory(categoryStr: string): ParsedIncomeSource {
  return parseIncomeRow({ id: '', category: categoryStr });
}

export function parseExpensePlanCategory(categoryStr: string): ParsedExpensePlan {
  return parseExpensePlanRow({ id: '', category: categoryStr });
}

export function parseIncomeRow(row: any): ParsedIncomeSource {
  const rawCategory = row.category || '';
  let name = 'Expected Income';
  let source = '';

  if (rawCategory.includes('|')) {
    const parts = rawCategory.split('|');
    try {
      const meta = JSON.parse(parts.slice(1).join('|'));
      if (meta.name) name = meta.name;
      if (meta.source) source = meta.source;
    } catch {
      // fallback
    }
  } else if (rawCategory.startsWith('{')) {
    try {
      const meta = JSON.parse(rawCategory);
      if (meta.name) name = meta.name;
      if (meta.source) source = meta.source;
    } catch {
      // fallback
    }
  }

  return {
    id: row.id,
    name,
    source,
    amount: Number(row.amount) || 0,
    rawCategory
  };
}

export function serializeIncomeCategory(name: string, source: string = ''): string {
  const cleanName = name.trim() || 'Expected Income';
  return `__EXPECTED_INCOME__|${JSON.stringify({ name: cleanName, source: source.trim() })}`;
}

export function parseExpensePlanRow(row: any): ParsedExpensePlan {
  const rawCategory = row.category || 'Other';
  let category = rawCategory;
  let name = rawCategory;
  let subItems: PlanSubItem[] = [];
  let notes = '';

  if (rawCategory.startsWith('PLAN_JSON|')) {
    try {
      const meta = JSON.parse(rawCategory.substring(10));
      category = meta.category || 'Other';
      name = meta.name || category;
      subItems = Array.isArray(meta.subItems) ? meta.subItems : [];
      notes = meta.notes || '';
    } catch {
      // fallback
    }
  } else if (rawCategory.startsWith('{')) {
    try {
      const meta = JSON.parse(rawCategory);
      category = meta.category || 'Other';
      name = meta.name || category;
      subItems = Array.isArray(meta.subItems) ? meta.subItems : [];
      notes = meta.notes || '';
    } catch {
      // fallback
    }
  }

  return {
    id: row.id,
    category,
    name,
    amount: Number(row.amount) || 0,
    subItems,
    notes,
    rawCategory
  };
}

export function serializeExpensePlanCategory(
  category: string,
  name: string,
  subItems: PlanSubItem[] = [],
  notes: string = ''
): string {
  const cleanCategory = category.trim() || 'Other';
  const cleanName = name.trim() || cleanCategory;
  return `PLAN_JSON|${JSON.stringify({
    category: cleanCategory,
    name: cleanName,
    subItems,
    notes
  })}`;
}
