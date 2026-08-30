import type { Member } from '../../types'

export function memberPositionLabel(member: Pick<Member, 'name' | 'position'>): string {
  const position = member.position?.name?.trim()
  return position ? `${member.name} · ${position}` : member.name
}

export function memberApproverKeywords(member: Pick<Member, 'name' | 'email' | 'username' | 'position'>): string {
  return [member.name, member.email, member.username, member.position?.name].filter(Boolean).join(' ')
}

export function buildApproverMemberOptions(members: Member[], excludeUserIds: number[]) {
  return members
    .filter((m) => m.is_active && !excludeUserIds.includes(m.id))
    .map((m) => ({
      value: String(m.id),
      label: memberPositionLabel(m),
      keywords: memberApproverKeywords(m),
    }))
}

export function approvalRowLabel(row: Pick<{ name: string; position?: string | null }, 'name' | 'position'>): string {
  const position = row.position?.trim()
  return position ? `${row.name} · ${position}` : row.name
}
